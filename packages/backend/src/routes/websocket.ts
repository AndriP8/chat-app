import type { WebSocket } from '@fastify/websocket';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import { envConfig } from '@/config/env';
import {
  conversationParticipants,
  conversations,
  db,
  messages,
  type NewMessage,
  users,
} from '@/db';
import { type MessageResponse, sendMessageSchema } from '@/schemas/conversation';
import { messageOrderingService } from '@/services/messageOrderingService';

interface JWTPayload {
  user_id: string;
  email: string;
}

interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  profile_picture_url?: string | null;
}

interface SendMessageData {
  conversationId: string;
  content: string;
  tempId?: string;
}

interface ConversationData {
  conversationId: string;
}

interface MessageStatusData {
  messageId: string;
  conversationId: string;
}

type WebSocketMessage =
  | {
      type: 'send_message';
      data: SendMessageData;
    }
  | {
      type: 'join_conversation' | 'leave_conversation';
      data: ConversationData;
    }
  | {
      type: 'message_delivered' | 'message_read';
      data: MessageStatusData;
    };

interface WebSocketConnection {
  socket: WebSocket;
  user: AuthenticatedUser;
  conversationIds: Set<string>;
}

class ConnectionManager {
  private userConnections = new Map<string, Set<WebSocketConnection>>();
  private tempIdMappings = new Map<
    string,
    { messageId: string; conversationId: string; timestamp: number }
  >();
  private readonly TEMP_ID_TTL = 30000; // 30 seconds TTL for tempId mappings

  addConnection(connection: WebSocketConnection): void {
    const userId = connection.user.id;
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId)!.add(connection);
  }

  removeConnection(connection: WebSocketConnection): void {
    const userId = connection.user.id;
    const userConnections = this.userConnections.get(userId);
    if (userConnections) {
      userConnections.delete(connection);
      if (userConnections.size === 0) {
        this.userConnections.delete(userId);
      }
    }
  }

  storeTempIdMapping(tempId: string, messageId: string, conversationId: string): void {
    this.tempIdMappings.set(tempId, {
      messageId,
      conversationId,
      timestamp: Date.now(),
    });

    this.cleanupExpiredTempIds();
  }

  getTempIdForMessage(messageId: string, conversationId: string): string | undefined {
    for (const [tempId, mapping] of this.tempIdMappings.entries()) {
      if (mapping.messageId === messageId && mapping.conversationId === conversationId) {
        return tempId;
      }
    }
    return undefined;
  }

  removeTempIdMapping(tempId: string): void {
    this.tempIdMappings.delete(tempId);
  }

  private cleanupExpiredTempIds(): void {
    const now = Date.now();
    for (const [tempId, mapping] of this.tempIdMappings.entries()) {
      if (now - mapping.timestamp > this.TEMP_ID_TTL) {
        this.tempIdMappings.delete(tempId);
      }
    }
  }

  addUserToConversation(userId: string, conversationId: string): void {
    const userConnections = this.userConnections.get(userId);
    if (userConnections) {
      for (const connection of userConnections) {
        connection.conversationIds.add(conversationId);
      }
    }
  }

  removeUserFromConversation(userId: string, conversationId: string): void {
    const userConnections = this.userConnections.get(userId);
    if (userConnections) {
      for (const connection of userConnections) {
        connection.conversationIds.delete(conversationId);
      }
    }
  }

  async broadcastToConversation(
    conversationId: string,
    message: Record<string, unknown>
  ): Promise<void> {
    try {
      const participants = await db
        .select({ user_id: conversationParticipants.user_id })
        .from(conversationParticipants)
        .where(eq(conversationParticipants.conversation_id, conversationId));

      const participantIds = new Set(participants.map((p) => p.user_id));

      for (const [userId, connections] of this.userConnections) {
        if (participantIds.has(userId)) {
          for (const connection of connections) {
            try {
              connection.socket.send(JSON.stringify(message));
            } catch (error) {
              console.error(`Failed to send message to user ${userId}:`, error);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error broadcasting to conversation:', error);
    }
  }
}

const connectionManager = new ConnectionManager();

async function authenticateWebSocket(request: FastifyRequest): Promise<AuthenticatedUser> {
  const token = request.cookies?.auth_token;

  if (!token) {
    throw new Error('No authentication token provided');
  }

  const payload = jwt.verify(token, envConfig.JWT_SECRET) as JWTPayload;
  const userId = payload.user_id;

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      profile_picture_url: users.profile_picture_url,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new Error('User not found');
  }

  return user;
}

async function isUserInConversation(userId: string, conversationId: string): Promise<boolean> {
  const participants = await db
    .select({ user_id: conversationParticipants.user_id })
    .from(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.user_id, userId),
        eq(conversationParticipants.conversation_id, conversationId)
      )
    );

  return participants.length > 0;
}

async function handleWebSocketMessage(connection: WebSocketConnection, message: WebSocketMessage) {
  const { socket, user } = connection;

  switch (message.type) {
    case 'send_message': {
      try {
        const { success, data, error } = sendMessageSchema.safeParse(message.data);
        if (!success) {
          socket.send(
            JSON.stringify({
              type: 'error',
              data: { message: 'Invalid message format', details: error.flatten().fieldErrors },
            })
          );
          return;
        }

        const { conversationId, content, tempId, sequenceNumber, createdAt } = data;

        const isParticipant = await isUserInConversation(user.id, conversationId);
        if (!isParticipant) {
          socket.send(
            JSON.stringify({
              type: 'error',
              data: { message: 'Not authorized to send messages to this conversation' },
            })
          );
          return;
        }

        // Insert the message immediately
        const messageValues: NewMessage = {
          content,
          sender_id: user.id,
          conversation_id: conversationId,
          status: 'sent',
          sequence_number: sequenceNumber ?? null,
        };

        if (createdAt) {
          messageValues.created_at = new Date(createdAt);
          messageValues.updated_at = new Date(createdAt);
        }

        const [newMessage] = await db.insert(messages).values(messageValues).returning();

        if (!newMessage) {
          socket.send(
            JSON.stringify({
              type: 'error',
              data: { message: 'Failed to create message' },
            })
          );
          return;
        }

        if (tempId) {
          connectionManager.storeTempIdMapping(tempId, newMessage.id, conversationId);
        }

        const messagesToDeliver = await messageOrderingService.processMessage(newMessage);

        if (messagesToDeliver.length === 0) {
          socket.send(
            JSON.stringify({
              type: 'message_buffered',
              data: {
                tempId,
                messageId: newMessage.id,
                sequenceNumber,
                status: 'buffered',
              },
            })
          );
          return;
        }

        await db
          .update(conversations)
          .set({ updated_at: new Date() })
          .where(eq(conversations.id, conversationId));

        for (const messageToDeliver of messagesToDeliver) {
          const messageTempId = connectionManager.getTempIdForMessage(
            messageToDeliver.id,
            conversationId
          );

          const messageResponse: MessageResponse = {
            id: messageToDeliver.id,
            content: messageToDeliver.content,
            status: messageToDeliver.status as 'sending' | 'sent' | 'delivered' | 'read' | 'failed',
            sender_id: messageToDeliver.sender_id,
            conversation_id: messageToDeliver.conversation_id,
            created_at: messageToDeliver.created_at,
            updated_at: messageToDeliver.updated_at,
            sender: {
              id: user.id,
              email: user.email,
              name: user.name,
              profile_picture_url: user.profile_picture_url ?? null,
            },
            tempId: messageTempId,
            sequence_number: messageToDeliver.sequence_number ?? undefined,
          };

          await connectionManager.broadcastToConversation(conversationId, {
            type: 'message',
            data: { message: messageResponse },
          });

          if (messageTempId) {
            connectionManager.removeTempIdMapping(messageTempId);
          }
        }
      } catch (error) {
        console.error('Send message error:', error);
        socket.send(
          JSON.stringify({
            type: 'error',
            data: { message: 'Failed to send message' },
          })
        );
      }
      break;
    }

    case 'join_conversation': {
      const data = message.data;
      if (!data.conversationId || typeof data.conversationId !== 'string') {
        socket.send(
          JSON.stringify({
            type: 'error',
            data: { message: 'Invalid conversation ID' },
          })
        );
        return;
      }

      const isParticipant = await isUserInConversation(user.id, data.conversationId);
      if (!isParticipant) {
        socket.send(
          JSON.stringify({
            type: 'error',
            data: { message: 'Not authorized to join this conversation' },
          })
        );
        return;
      }

      connectionManager.addUserToConversation(user.id, data.conversationId);

      socket.send(
        JSON.stringify({
          type: 'joined_conversation',
          data: { conversationId: data.conversationId },
        })
      );
      break;
    }

    case 'leave_conversation': {
      const data = message.data;
      if (!data.conversationId || typeof data.conversationId !== 'string') {
        return;
      }
      connectionManager.removeUserFromConversation(user.id, data.conversationId);
      break;
    }

    case 'message_delivered': {
      const data = message.data;
      if (
        !data.messageId ||
        !data.conversationId ||
        typeof data.messageId !== 'string' ||
        typeof data.conversationId !== 'string'
      ) {
        socket.send(
          JSON.stringify({
            type: 'error',
            data: { message: 'Invalid message ID or conversation ID' },
          })
        );
        return;
      }

      try {
        const isParticipant = await isUserInConversation(user.id, data.conversationId);
        if (!isParticipant) {
          socket.send(
            JSON.stringify({
              type: 'error',
              data: { message: 'Not authorized to update message status' },
            })
          );
          return;
        }

        await db
          .update(messages)
          .set({ status: 'delivered', updated_at: new Date() })
          .where(eq(messages.id, data.messageId));

        await connectionManager.broadcastToConversation(data.conversationId, {
          type: 'message_status_updated',
          data: {
            messageId: data.messageId,
            status: 'delivered',
            updatedBy: user.id,
          },
        });
      } catch (error) {
        console.error('Message delivered error:', error);
        socket.send(
          JSON.stringify({
            type: 'error',
            data: { message: 'Failed to update message status' },
          })
        );
      }
      break;
    }

    case 'message_read': {
      const data = message.data;
      if (
        !data.messageId ||
        !data.conversationId ||
        typeof data.messageId !== 'string' ||
        typeof data.conversationId !== 'string'
      ) {
        socket.send(
          JSON.stringify({
            type: 'error',
            data: { message: 'Invalid message ID or conversation ID' },
          })
        );
        return;
      }

      try {
        const isParticipant = await isUserInConversation(user.id, data.conversationId);
        if (!isParticipant) {
          socket.send(
            JSON.stringify({
              type: 'error',
              data: { message: 'Not authorized to update message status' },
            })
          );
          return;
        }

        const [currentMessage] = await db
          .select({ status: messages.status })
          .from(messages)
          .where(eq(messages.id, data.messageId))
          .limit(1);

        if (currentMessage?.status !== 'read') {
          await db
            .update(messages)
            .set({ status: 'read', updated_at: new Date() })
            .where(eq(messages.id, data.messageId));

          await connectionManager.broadcastToConversation(data.conversationId, {
            type: 'message_status_updated',
            data: {
              messageId: data.messageId,
              status: 'read',
              updatedBy: user.id,
            },
          });
        }
      } catch (error) {
        console.error('Message read error:', error);
        socket.send(
          JSON.stringify({
            type: 'error',
            data: { message: 'Failed to update message status' },
          })
        );
      }
      break;
    }

    default:
      socket.send(
        JSON.stringify({
          type: 'error',
          data: { message: 'Unknown message type' },
        })
      );
  }
}

export async function websocketRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/ws', { websocket: true }, async (socket, request) => {
    try {
      const user = await authenticateWebSocket(request);

      const wsConnection: WebSocketConnection = {
        socket,
        user,
        conversationIds: new Set(),
      };

      connectionManager.addConnection(wsConnection);

      socket.send(
        JSON.stringify({
          type: 'connected',
          data: { message: 'Connected successfully' },
        })
      );

      socket.on('message', async (data: Buffer) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          await handleWebSocketMessage(wsConnection, message);
        } catch (_error) {
          socket.send(
            JSON.stringify({
              type: 'error',
              data: { message: 'Invalid message format' },
            })
          );
        }
      });

      socket.on('close', () => {
        connectionManager.removeConnection(wsConnection);
      });

      socket.on('error', (error: Error) => {
        console.error('WebSocket error:', error);
        connectionManager.removeConnection(wsConnection);
      });
    } catch (error) {
      console.error('WebSocket authentication failed:', error);
      socket.close();
    }
  });
}

export { connectionManager };
