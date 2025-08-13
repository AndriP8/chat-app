import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc, lt, sql } from 'drizzle-orm';
import { db, users, conversations, conversationParticipants, messages } from '@/db';
import { authMiddleware } from '@/middleware/auth';
import {
  getMessagesSchema,
  type GetMessagesQuery,
  type ConversationResponse,
  type MessageResponse,
  type UserResponse,
} from '@/schemas/conversation';

// Helper function to format user response
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
function formatUserResponse(user: any): UserResponse {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    profile_picture_url: user.profile_picture_url,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

// Helper function to format message response
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
function formatMessageResponse(message: any, sender: any): MessageResponse {
  return {
    id: message.id,
    content: message.content,
    status: message.status,
    sender_id: message.sender_id,
    conversation_id: message.conversation_id,
    created_at: message.created_at,
    updated_at: message.updated_at,
    sender: formatUserResponse(sender),
  };
}

export async function conversationRoutes(fastify: FastifyInstance): Promise<void> {
  // Add auth middleware to all routes
  fastify.addHook('preHandler', authMiddleware);
  fastify.get('/', {
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.id;

        const otherUsers = await db
          .select({
            id: users.id,
            email: users.email,
            name: users.name,
            profile_picture_url: users.profile_picture_url,
            created_at: users.created_at,
            updated_at: users.updated_at,
          })
          .from(users)
          .where(sql`${users.id} != ${userId}`);

        // For each other user, check if conversation exists, if not create one
        for (const otherUser of otherUsers) {
          // Check if conversation already exists between current user and this other user
          const existingConversation = await db
            .select({ id: conversations.id })
            .from(conversations)
            .innerJoin(
              conversationParticipants,
              eq(conversations.id, conversationParticipants.conversation_id)
            )
            .where(
              and(
                eq(conversationParticipants.user_id, userId),
                sql`${conversations.id} IN (
                  SELECT conversation_id FROM ${conversationParticipants} 
                  WHERE user_id = ${otherUser.id}
                )`
              )
            )
            .limit(1);

          // If no conversation exists, create one
          if (existingConversation.length === 0) {
            const [newConversation] = await db
              .insert(conversations)
              .values({
                name: null, // No name for direct conversations
                created_by: userId,
              })
              .returning();

            if (newConversation) {
              // Add both users as participants
              await db.insert(conversationParticipants).values([
                {
                  conversation_id: newConversation.id,
                  user_id: userId,
                },
                {
                  conversation_id: newConversation.id,
                  user_id: otherUser.id,
                },
              ]);
            }
          }
        }

        // Now get all conversations where user is a participant
        const userConversations = await db
          .select({
            id: conversations.id,
            name: conversations.name,
            created_by: conversations.created_by,
            created_at: conversations.created_at,
            updated_at: conversations.updated_at,
          })
          .from(conversations)
          .innerJoin(
            conversationParticipants,
            eq(conversations.id, conversationParticipants.conversation_id)
          )
          .where(eq(conversationParticipants.user_id, userId))
          .orderBy(desc(conversations.updated_at));

        // Get participants and last message for each conversation
        const conversationsWithDetails: ConversationResponse[] = [];

        for (const conversation of userConversations) {
          // Get participants
          const participants = await db
            .select({
              id: users.id,
              email: users.email,
              name: users.name,
              profile_picture_url: users.profile_picture_url,
              created_at: users.created_at,
              updated_at: users.updated_at,
            })
            .from(users)
            .innerJoin(conversationParticipants, eq(users.id, conversationParticipants.user_id))
            .where(eq(conversationParticipants.conversation_id, conversation.id));

          // Get last message
          const [lastMessageData] = await db
            .select({
              message: {
                id: messages.id,
                content: messages.content,
                status: messages.status,
                sender_id: messages.sender_id,
                conversation_id: messages.conversation_id,
                created_at: messages.created_at,
                updated_at: messages.updated_at,
              },
              sender: {
                id: users.id,
                email: users.email,
                name: users.name,
                profile_picture_url: users.profile_picture_url,
                created_at: users.created_at,
                updated_at: users.updated_at,
              },
            })
            .from(messages)
            .innerJoin(users, eq(messages.sender_id, users.id))
            .where(eq(messages.conversation_id, conversation.id))
            .orderBy(desc(messages.created_at))
            .limit(1);

          // Count unread messages (for now, we'll set to 0 as read status tracking is complex)
          const unreadCount = 0;

          conversationsWithDetails.push({
            id: conversation.id,
            name: conversation.name,
            created_by: conversation.created_by,
            created_at: conversation.created_at,
            updated_at: conversation.updated_at,
            participants: participants.map(formatUserResponse),
            last_message: lastMessageData
              ? formatMessageResponse(lastMessageData.message, lastMessageData.sender)
              : null,
          });
        }

        return reply.send({
          success: true,
          data: conversationsWithDetails,
        });
      } catch (error) {
        console.error('Get conversations error:', error);
        return reply.status(500).send({
          success: false,
          error: 'Failed to fetch conversations',
        });
      }
    },
  });

  // GET /api/conversations/:id/messages - Fetch messages for a conversation
  fastify.get('/:id/messages', {
    handler: async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const conversationId = request.params.id;
        const userId = request.user!.id;

        const { success, data, error } = getMessagesSchema.safeParse(request.query);
        if (!success) {
          return reply.status(400).send({
            success: false,
            error: 'Validation failed',
            details: error.flatten().fieldErrors,
          });
        }

        const { limit, before } = data as GetMessagesQuery;

        // Check if user is participant in conversation
        const [participation] = await db
          .select()
          .from(conversationParticipants)
          .where(
            and(
              eq(conversationParticipants.conversation_id, conversationId),
              eq(conversationParticipants.user_id, userId)
            )
          )
          .limit(1);

        if (!participation) {
          return reply.status(403).send({
            success: false,
            error: 'Access denied to this conversation',
          });
        }

        // Build query conditions
        const baseCondition = eq(messages.conversation_id, conversationId);
        const whereConditions = before
          ? and(baseCondition, lt(messages.id, before))
          : baseCondition;

        // Get messages with sender info
        const messagesData = await db
          .select({
            message: {
              id: messages.id,
              content: messages.content,
              status: messages.status,
              sender_id: messages.sender_id,
              conversation_id: messages.conversation_id,
              created_at: messages.created_at,
              updated_at: messages.updated_at,
            },
            sender: {
              id: users.id,
              email: users.email,
              name: users.name,
              profile_picture_url: users.profile_picture_url,
              created_at: users.created_at,
              updated_at: users.updated_at,
            },
          })
          .from(messages)
          .innerJoin(users, eq(messages.sender_id, users.id))
          .where(whereConditions)
          .orderBy(desc(messages.created_at))
          .limit(limit + 1); // Get one extra to check if there are more

        const hasMore = messagesData.length > limit;
        const messagesToReturn = hasMore ? messagesData.slice(0, limit) : messagesData;

        const formattedMessages = messagesToReturn.map((item) =>
          formatMessageResponse(item.message, item.sender)
        );

        return reply.send({
          success: true,
          data: formattedMessages.reverse(), // Reverse to show oldest first
          hasMore,
        });
      } catch (error) {
        console.error('Get messages error:', error);
        return reply.status(500).send({
          success: false,
          error: 'Failed to fetch messages',
        });
      }
    },
  });
}
