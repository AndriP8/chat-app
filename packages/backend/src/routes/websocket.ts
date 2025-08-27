import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import jwt from 'jsonwebtoken';
import { eq, and } from 'drizzle-orm';
import { db, users, conversations, conversationParticipants, messages } from '@/db';
import { envConfig } from '@/config/env';
import { sendMessageSchema, type MessageResponse } from '@/schemas/conversation';

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

// Types for WebSocket messages
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

// Connection manager to track active WebSocket connections
class ConnectionManager {
  private userConnections = new Map<string, Set<WebSocketConnection>>();

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

  broadcastToConversation(conversationId: string, message: Record<string, unknown>): void {
    for (const [_userId, connections] of this.userConnections) {
      for (const connection of connections) {
        if (
          connection.conversationIds.has(conversationId)
        ) {
          connection.socket.send(JSON.stringify(message));
        }
      }
    }
  }
}

const connectionManager = new ConnectionManager();

// Authenticate WebSocket connection
async function authenticateWebSocket(request: FastifyRequest): Promise<AuthenticatedUser> {
  // Try to get token from cookie first
  const token = request.cookies?.auth_token;

  if (!token) {
    throw new Error('No authentication token provided');
  }

  // Verify token
  const payload = jwt.verify(token, envConfig.JWT_SECRET) as JWTPayload;
  const userId = payload.user_id;

  // Get user from database
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

// Check if user is participant in conversation
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

// Handle incoming WebSocket messages
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

        const { conversationId, content, tempId } = data;

        // Check if user is participant in conversation
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

        // Create message in database
        const [newMessage] = await db
          .insert(messages)
          .values({
            content,
            sender_id: user.id,
            conversation_id: conversationId,
            status: 'sent',
          })
          .returning();

        if (!newMessage) {
          socket.send(
            JSON.stringify({
              type: 'error',
              data: { message: 'Failed to create message' },
            })
          );
          return;
        }

        // Update conversation's updated_at timestamp
        await db
          .update(conversations)
          .set({ updated_at: new Date() })
          .where(eq(conversations.id, conversationId));

        const messageResponse: MessageResponse = {
          id: newMessage.id,
          content: newMessage.content,
          status: newMessage.status as 'sending' | 'sent' | 'delivered' | 'read' | 'failed',
          sender_id: newMessage.sender_id,
          conversation_id: newMessage.conversation_id,
          created_at: newMessage.created_at,
          updated_at: newMessage.updated_at,
          sender: {
            id: user.id,
            email: user.email,
            name: user.name,
            profile_picture_url: user.profile_picture_url ?? null,
          },
          tempId,
        };

        // Broadcast message to all participants in the conversation
        connectionManager.broadcastToConversation(conversationId, {
          type: 'message',
          data: { message: messageResponse },
        });
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

      // Check if user is participant in conversation
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

        // Update message status to delivered
        await db
          .update(messages)
          .set({ status: 'delivered', updated_at: new Date() })
          .where(eq(messages.id, data.messageId));

        connectionManager.broadcastToConversation(data.conversationId, {
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

          connectionManager.broadcastToConversation(data.conversationId, {
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
  // WebSocket endpoint
  fastify.get('/ws', { websocket: true }, async (socket, request) => {
    try {
      // Authenticate the WebSocket connection
      const user = await authenticateWebSocket(request);

      // Create connection object
      const wsConnection: WebSocketConnection = {
        socket,
        user,
        conversationIds: new Set(),
      };

      // Add to connection manager
      connectionManager.addConnection(wsConnection);

      // Send welcome message
      socket.send(
        JSON.stringify({
          type: 'connected',
          data: { message: 'Connected successfully' },
        })
      );

      // Handle incoming messages
      socket.on('message', async (data: Buffer) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          await handleWebSocketMessage(wsConnection, message);
        } catch (error) {
          socket.send(
            JSON.stringify({
              type: 'error',
              data: { message: 'Invalid message format' },
            })
          );
        }
      });

      // Handle connection close
      socket.on('close', () => {
        connectionManager.removeConnection(wsConnection);
      });

      // Handle errors
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

// Export connection manager for use in other routes
export { connectionManager };
