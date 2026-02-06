import { and, desc, eq, lt } from 'drizzle-orm';
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
import { transformMessageToResponse, transformUserToResponse } from '@/utils/transformers';

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
  return transformUserToResponse({
    ...user,
    password_hash: '',
    is_demo: false,
  });
}

function formatMessageResponse(message: MessageDbResult, sender: UserDbResult) {
  return transformMessageToResponse({
    ...message,
    sender: {
      ...sender,
      password_hash: '',
      is_demo: false,
    },
  }) as Required<MessageResponse>;
}

export async function conversationRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authMiddleware);
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user!.id;

      const userParticipations = await db
        .select({ conversationId: conversationParticipants.conversation_id })
        .from(conversationParticipants)
        .where(eq(conversationParticipants.user_id, userId));

      if (userParticipations.length === 0) {
        return reply.send({ success: true, data: [] });
      }

      const conversationIds = userParticipations.map((p) => p.conversationId);
      const firstId = conversationIds[0] as string;

      const [conversationsData, allParticipants, allLastMessages] = await Promise.all([
        db
          .select({
            id: conversations.id,
            name: conversations.name,
            created_by: conversations.created_by,
            created_at: conversations.created_at,
            updated_at: conversations.updated_at,
          })
          .from(conversations)
          .where(eq(conversations.id, firstId))
          .orderBy(desc(conversations.updated_at)),

        db
          .select({
            conversationId: conversationParticipants.conversation_id,
            user: {
              id: users.id,
              email: users.email,
              name: users.name,
              profile_picture_url: users.profile_picture_url,
              created_at: users.created_at,
              updated_at: users.updated_at,
            },
          })
          .from(conversationParticipants)
          .innerJoin(users, eq(users.id, conversationParticipants.user_id))
          .where(eq(conversationParticipants.conversation_id, firstId)),

        db
          .select({
            conversationId: messages.conversation_id,
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
          .innerJoin(users, eq(users.id, messages.sender_id))
          .where(eq(messages.conversation_id, firstId))
          .orderBy(desc(messages.created_at)),
      ]);

      const participantsByConv = allParticipants.reduce<Record<string, UserResponse[]>>(
        (acc, p) => {
          let list = acc[p.conversationId];
          if (!list) {
            list = [];
            acc[p.conversationId] = list;
          }
          list.push(formatUserResponse(p.user));
          return acc;
        },
        {}
      );

      const lastMessageByConv = allLastMessages.reduce<
        Record<string, ReturnType<typeof formatMessageResponse>>
      >((acc, m) => {
        if (!acc[m.conversationId]) {
          acc[m.conversationId] = formatMessageResponse(m.message as MessageDbResult, m.sender);
        }
        return acc;
      }, {});

      const conversationsWithDetails: ConversationResponse[] = conversationsData.map(
        (conversation) => ({
          id: conversation.id,
          name: conversation.name,
          createdBy: conversation.created_by,
          createdAt: conversation.created_at,
          updatedAt: conversation.updated_at,
          participants: participantsByConv[conversation.id] || [],
          lastMessage: lastMessageByConv[conversation.id] || null,
        })
      );

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

        const { limit, nextCursor } = data as GetMessagesQuery;

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
        const whereConditions = nextCursor
          ? and(baseCondition, lt(messages.id, nextCursor))
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

        const nextCursorValue =
          hasMore && messagesToReturn.length > 0
            ? messagesToReturn[messagesToReturn.length - 1]?.message.id
            : null;

        return reply.send({
          success: true,
          data: formattedMessages.reverse(),
          hasMore,
          nextCursor: nextCursorValue,
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
