import { and, desc, eq, lt, ne, sql } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { conversationParticipants, conversations, db, messages, users } from '@/db';
import { authMiddleware } from '@/middleware/auth';
import {
  type ConversationResponse,
  type GetMessagesQuery,
  getMessagesSchema,
  type MessageResponse,
  type MessageStatusEnum,
  type UserResponse,
} from '@/schemas/conversation';

type UserDbResult = {
  id: string;
  email: string;
  name: string;
  profile_picture_url: string | null;
  created_at: Date;
  updated_at: Date;
};

type MessageDbResult = {
  id: string;
  content: string;
  status: MessageStatusEnum;
  sender_id: string;
  sequence_number: number | null;
  conversation_id: string;
  created_at: Date;
  updated_at: Date;
};

function formatUserResponse(user: UserDbResult): UserResponse {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    profile_picture_url: user.profile_picture_url,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

function formatMessageResponse(message: MessageDbResult, sender: UserDbResult): MessageResponse {
  return {
    id: message.id,
    content: message.content,
    status: message.status,
    sender_id: message.sender_id,
    sequence_number: message.sequence_number ?? undefined,
    conversation_id: message.conversation_id,
    created_at: message.created_at,
    updated_at: message.updated_at,
    sender: formatUserResponse(sender),
  };
}

export async function conversationRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authMiddleware);
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user!.id;

      // Get current user to check if they are a demo user
      const [currentUser] = await db
        .select({ is_demo: users.is_demo })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!currentUser) {
        return reply.status(404).send({
          success: false,
          error: 'User not found',
        });
      }

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
        .where(and(ne(users.id, userId), eq(users.is_demo, currentUser.is_demo)));

      for (const otherUser of otherUsers) {
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

        if (existingConversation.length === 0) {
          const [newConversation] = await db
            .insert(conversations)
            .values({
              name: null, // No name for direct conversations
              created_by: userId,
            })
            .returning();

          if (newConversation) {
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

      const conversationsWithDetails: ConversationResponse[] = [];

      for (const conversation of userConversations) {
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

        const [lastMessageData] = await db
          .select({
            message: {
              id: messages.id,
              content: messages.content,
              status: messages.status,
              sender_id: messages.sender_id,
              sequence_number: messages.sequence_number,
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

        conversationsWithDetails.push({
          id: conversation.id,
          name: conversation.name,
          created_by: conversation.created_by,
          created_at: conversation.created_at,
          updated_at: conversation.updated_at,
          participants: participants.map(formatUserResponse),
          last_message: lastMessageData
            ? formatMessageResponse(
                lastMessageData.message as MessageDbResult,
                lastMessageData.sender
              )
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
  });

  fastify.get(
    '/:id/messages',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
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

        const { limit, next_cursor } = data as GetMessagesQuery;

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

        const baseCondition = eq(messages.conversation_id, conversationId);
        const whereConditions = next_cursor
          ? and(baseCondition, lt(messages.id, next_cursor))
          : baseCondition;

        const messagesData = await db
          .select({
            message: {
              id: messages.id,
              content: messages.content,
              status: messages.status,
              sender_id: messages.sender_id,
              sequence_number: messages.sequence_number,
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
          .limit(limit + 1);

        const hasMore = messagesData.length > limit;
        const messagesToReturn = hasMore ? messagesData.slice(0, limit) : messagesData;

        const formattedMessages = messagesToReturn.map((item) =>
          formatMessageResponse(item.message as MessageDbResult, item.sender)
        );

        const nextCursor =
          hasMore && messagesToReturn.length > 0
            ? messagesToReturn[messagesToReturn.length - 1]?.message.id
            : null;

        return reply.send({
          success: true,
          data: formattedMessages.reverse(),
          hasMore,
          next_cursor: nextCursor,
        });
      } catch (error) {
        console.error('Get messages error:', error);
        return reply.status(500).send({
          success: false,
          error: 'Failed to fetch messages',
        });
      }
    }
  );
}
