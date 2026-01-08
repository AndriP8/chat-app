import { ensureDate } from '@/utils/helpers';
import type {
  Conversation,
  ConversationParticipant,
  DraftMessage,
  Message,
  PaginationMetadata,
  SendMessageRequest,
  User,
} from '../types/database';
import { db } from './database';

export class DatabaseOperations {
  get db() {
    return db;
  }
  // ===== USER OPERATIONS =====
  async upsertUser(user: Omit<User, 'createdAt' | 'updatedAt'>): Promise<User> {
    try {
      const existingUser = await db.users.get(user.id);
      if (existingUser) {
        await db.users.update(user.id, user);
        return { ...existingUser, ...user, updatedAt: new Date() };
      }
      const newUser = { ...user, createdAt: new Date(), updatedAt: new Date() };
      await db.users.add(newUser);
      return newUser;
    } catch (error) {
      throw new Error(`Failed to upsert user: ${error}`);
    }
  }

  async getUser(userId: string): Promise<User | undefined> {
    try {
      return await db.users.get(userId);
    } catch (error) {
      throw new Error(`Failed to get user: ${error}`);
    }
  }

  private async getUsers(userIds: string[]): Promise<User[]> {
    try {
      return await db.users.where('id').anyOf(userIds).toArray();
    } catch (error) {
      throw new Error(`Failed to get users: ${error}`);
    }
  }
  // ===== CONVERSATION OPERATIONS =====
  async upsertConversation(conversation: Conversation): Promise<Conversation> {
    try {
      const existingConversation = await db.conversations.get(conversation.id);
      if (existingConversation) {
        await db.conversations.update(conversation.id, conversation);
        return { ...existingConversation, ...conversation, updatedAt: new Date() };
      }
      const newConversation = { ...conversation };
      await db.conversations.add(newConversation);
      return newConversation;
    } catch (error) {
      throw new Error(`Failed to upsert conversation: ${error}`);
    }
  }

  /**
   * Helper method to get the last message for each conversation
   */
  private async getLastMessagesByConversation(
    conversationId: string
  ): Promise<(Message & { sender: User }) | null> {
    try {
      // Get all messages for this conversation, sorted by createdAt ascending
      const allMessages = await db.messages
        .where('conversationId')
        .equals(conversationId)
        .sortBy('createdAt');

      const lastMessage = allMessages[allMessages.length - 1];
      if (!lastMessage) {
        return null;
      }

      const sender = await this.getUser(lastMessage.senderId);
      if (!sender) {
        return null;
      }

      const messageWithSender = {
        ...lastMessage,
        sender,
      };

      return messageWithSender;
    } catch (error) {
      throw new Error(`Failed to get last message by conversation: ${error}`);
    }
  }

  async getUserConversations(
    userId: string
  ): Promise<
    Array<
      Conversation & { participants: User[]; lastMessage: (Message & { sender: User }) | null }
    >
  > {
    try {
      const conversationUser: ConversationParticipant | undefined =
        await db.conversation_participants.where('userId').equals(userId).first();

      if (!conversationUser) {
        return [];
      }

      const conversationId = conversationUser.conversationId;

      const [conversations, allParticipantRecords, lastMessage] = await Promise.all([
        // Get conversations
        db.conversations
          .where('id')
          .equals(conversationId)
          .toArray(),

        // Get all conversation participants
        db.conversation_participants
          .where('conversationId')
          .equals(conversationId)
          .toArray(),

        // Get last message for each conversation
        this.getLastMessagesByConversation(conversationId),
      ]);

      const userIds = allParticipantRecords.map((p) => p.userId);
      const users = await this.getUsers(userIds);
      const userMap = new Map(users.map((u) => [u.id, u]));

      const participants = allParticipantRecords.reduce<User[]>((acc, p) => {
        const user = userMap.get(p.userId);
        if (user) acc.push(user);
        return acc;
      }, []);

      return conversations.map((conversation) => ({
        ...conversation,
        participants,
        lastMessage: lastMessage,
      }));
    } catch (error) {
      throw new Error(`Failed to get user conversations: ${error}`);
    }
  }

  // ===== MESSAGE OPERATIONS =====
  async upsertMessage(
    message: Partial<Message> &
      Pick<Message, 'id' | 'content' | 'status' | 'senderId' | 'conversationId'>
  ): Promise<Message> {
    try {
      const existingMessage = await db.messages.get(message.id);
      if (existingMessage) {
        const updatedMessage = {
          ...existingMessage,
          ...message,
          createdAt: ensureDate(existingMessage.createdAt),
          updatedAt: message.updatedAt ? ensureDate(message.updatedAt) : new Date(),
        };
        await db.messages.update(message.id, updatedMessage);
        return updatedMessage;
      }

      const newMessage: Message = {
        ...message,
        createdAt: message.createdAt ? ensureDate(message.createdAt) : new Date(),
        updatedAt: message.updatedAt ? ensureDate(message.updatedAt) : new Date(),
      };
      await db.messages.add(newMessage);
      return newMessage;
    } catch (error) {
      throw new Error(`Failed to upsert message: ${error}`);
    }
  }

  /**
   * Replace a temporary message with the server message
   */
  async replaceTemporaryMessage(
    tempId: string,
    serverMessage: Partial<Message> &
      Pick<Message, 'id' | 'content' | 'status' | 'senderId' | 'conversationId'>
  ): Promise<Message> {
    try {
      return await db.transaction('rw', [db.messages], async () => {
        const existingMessage = await db.messages.where('tempId').equals(tempId).first();

        if (existingMessage) {
          await db.messages.delete(existingMessage.id);
        }

        const newMessage: Message = {
          ...serverMessage,
          createdAt: serverMessage.createdAt ? ensureDate(serverMessage.createdAt) : new Date(),
          updatedAt: serverMessage.updatedAt ? ensureDate(serverMessage.updatedAt) : new Date(),
          tempId: undefined,
        };
        await db.messages.add(newMessage);

        return newMessage;
      });
    } catch (error) {
      throw new Error(`Failed to replace temporary message: ${error}`);
    }
  }

  /**
   * Get messages for a conversation with pagination
   */
  async getConversationMessages(
    conversationId: string,
    options: {
      limit?: number;
      nextCursor?: string;
      after?: Date;
    } = {}
  ): Promise<Message[]> {
    try {
      const { limit = 50, nextCursor, after } = options;

      let query = db.messages.where('conversationId').equals(conversationId);

      if (nextCursor) {
        query = query.and((message) => message.id < nextCursor);
      }

      if (after) {
        query = query.and((message) => ensureDate(message.createdAt) > after);
      }

      const messages = await query.toArray();

      // Sort messages by createdAt (primary) for chronological order
      // When timestamps are equal, use sequence numbers to maintain order
      const sortedMessages = messages.sort((a, b) => {
        const timeA = ensureDate(a.createdAt).getTime();
        const timeB = ensureDate(b.createdAt).getTime();

        if (timeA !== timeB) {
          return timeA - timeB;
        }

        const seqA = a.sequenceNumber ?? 0;
        const seqB = b.sequenceNumber ?? 0;
        return seqA - seqB;
      });
      return sortedMessages.slice(-limit);
    } catch (error) {
      throw new Error(`Failed to get conversation messages: ${error}`);
    }
  }

  /**
   * Check if there are older messages available for pagination
   */
  async hasOlderMessages(conversationId: string, oldestMessageId: string): Promise<boolean> {
    try {
      const oldestMessage = await db.messages.get(oldestMessageId);
      if (!oldestMessage) return false;

      const olderMessagesCount = await db.messages
        .where('conversationId')
        .equals(conversationId)
        .and((message) => ensureDate(message.createdAt) < ensureDate(oldestMessage.createdAt))
        .count();

      return olderMessagesCount > 0;
    } catch (error) {
      console.error(`Failed to check for older messages: ${error}`);
      return false;
    }
  }

  /**
   * Get pagination metadata for a conversation
   */
  async getPaginationMetadata(conversationId: string): Promise<PaginationMetadata | undefined> {
    try {
      return await db.pagination_metadata.get(conversationId);
    } catch (error) {
      console.error(`Failed to get pagination metadata: ${error}`);
      return undefined;
    }
  }

  /**
   * Update or create pagination metadata for a conversation
   */
  async upsertPaginationMetadata(
    conversationId: string,
    metadata: Omit<PaginationMetadata, 'conversationId' | 'updatedAt'>
  ): Promise<PaginationMetadata> {
    try {
      const existingMetadata = await db.pagination_metadata.get(conversationId);
      const paginationMetadata = {
        conversationId: conversationId,
        ...metadata,
        updatedAt: new Date(),
      };
      if (existingMetadata) {
        await db.pagination_metadata.update(conversationId, paginationMetadata);
        return paginationMetadata;
      }
      await db.pagination_metadata.add(paginationMetadata);
      return paginationMetadata;
    } catch (error) {
      throw new Error(`Failed to upsert pagination metadata: ${error}`);
    }
  }

  /**
   * Clear pagination metadata for a conversation
   */
  async clearPaginationMetadata(conversationId: string): Promise<void> {
    try {
      await db.pagination_metadata.delete(conversationId);
    } catch (error) {
      console.error(`Failed to clear pagination metadata: ${error}`);
    }
  }

  /**
   * Update message status
   */
  async updateMessageStatus(messageId: string, status: Message['status']): Promise<void> {
    try {
      await db.messages.update(messageId, { status });
    } catch (error) {
      throw new Error(`Failed to update message status: ${error}`);
    }
  }

  /**
   * Get message by ID
   */
  async getMessageById(messageId: string): Promise<Message | undefined> {
    try {
      return await db.messages.get(messageId);
    } catch (error) {
      throw new Error(`Failed to get message by ID: ${error}`);
    }
  }

  /**
   * Get message by temp ID
   */
  async getMessageByTempId(tempId: string): Promise<Message | undefined> {
    try {
      return await db.messages.where('tempId').equals(tempId).first();
    } catch (error) {
      throw new Error(`Failed to get message by temp ID: ${error}`);
    }
  }

  // ===== CONVERSATION PARTICIPANT OPERATIONS =====

  /**
   * Add participant to conversation
   */
  async addConversationParticipant(
    participant: ConversationParticipant
  ): Promise<ConversationParticipant> {
    try {
      // Check if participant already exists
      const existing = await db.conversation_participants
        .where('[conversationId+userId]')
        .equals([participant.conversationId, participant.userId])
        .first();

      if (existing) {
        return existing;
      }

      await db.conversation_participants.add(participant);
      return participant;
    } catch (error) {
      console.error('Error in addConversationParticipant:', error);
      throw new Error(`Failed to add conversation participant: ${error}`);
    }
  }

  // ===== SEND MESSAGE REQUEST OPERATIONS =====

  /**
   * Create a new send message request
   */
  async createSendMessageRequest(
    request: Omit<SendMessageRequest, 'id' | 'createdAt'>
  ): Promise<SendMessageRequest> {
    try {
      const id = `${request.messageId}_${Date.now()}`;
      const newRequest: SendMessageRequest = {
        ...request,
        id,
        createdAt: new Date(),
      };
      await db.send_message_requests.add(newRequest);
      return newRequest;
    } catch (error) {
      throw new Error(`Failed to create send message request: ${error}`);
    }
  }

  /**
   * Get pending send message requests
   */
  async getPendingSendRequests(): Promise<SendMessageRequest[]> {
    try {
      const requests = await db.send_message_requests.where('status').equals('pending').toArray();
      return requests.sort(
        (a, b) => ensureDate(a.createdAt).getTime() - ensureDate(b.createdAt).getTime()
      );
    } catch (error) {
      throw new Error(`Failed to get pending send requests: ${error}`);
    }
  }

  /**
   * Update send message request status
   */
  async updateSendRequestStatus(
    requestId: string,
    status: SendMessageRequest['status'],
    errorMessage?: string
  ): Promise<void> {
    try {
      const updates: Partial<SendMessageRequest> = {
        status,
        lastSentAt: new Date(),
      };

      if (status === 'failed') {
        const request = await db.send_message_requests.get(requestId);
        if (request) {
          updates.retryCount = request.retryCount + 1;
          updates.errorMessage = errorMessage;
        }
      }

      await db.send_message_requests.update(requestId, updates);
    } catch (error) {
      throw new Error(`Failed to update send request status: ${error}`);
    }
  }

  /**
   * Delete send message request
   */
  async deleteSendRequest(requestId: string): Promise<void> {
    try {
      await db.send_message_requests.delete(requestId);
    } catch (error) {
      throw new Error(`Failed to delete send request: ${error}`);
    }
  }

  /**
   * Get send request by message ID
   */
  async getSendRequestByMessageId(messageId: string): Promise<SendMessageRequest | undefined> {
    try {
      return await db.send_message_requests.where('messageId').equals(messageId).first();
    } catch (error) {
      throw new Error(`Failed to get send request by message ID: ${error}`);
    }
  }

  /**
   * Get send requests by status
   */
  async getSendRequestsByStatus(
    status: SendMessageRequest['status']
  ): Promise<SendMessageRequest[]> {
    try {
      const requests = await db.send_message_requests.where('status').equals(status).toArray();

      return requests.sort(
        (a, b) => ensureDate(a.createdAt).getTime() - ensureDate(b.createdAt).getTime()
      );
    } catch (error) {
      throw new Error(`Failed to get send requests by status: ${error}`);
    }
  }

  /**
   * Clean up failed temporary messages older than specified time
   */
  async cleanupFailedTemporaryMessages(olderThanHours = 24): Promise<number> {
    try {
      const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000); // 24 hours ago

      return await db.transaction('rw', [db.messages], async () => {
        const failedMessages = await db.messages
          .where('status')
          .equals('failed')
          .and(
            (message) => message.tempId !== undefined && ensureDate(message.createdAt) < cutoffTime
          )
          .toArray();

        if (failedMessages.length > 0) {
          await db.messages.bulkDelete(failedMessages.map((m) => m.id));
        }

        return failedMessages.length;
      });
    } catch (error) {
      console.error(`Failed to cleanup failed temporary messages: ${error}`);
      return 0;
    }
  }

  /**
   * Clean up orphaned temporary messages (no corresponding send request)
   */
  async cleanupOrphanedTemporaryMessages(): Promise<number> {
    try {
      return await db.transaction('rw', [db.messages, db.send_message_requests], async () => {
        // Get all temporary messages
        const tempMessages = await db.messages
          .where('tempId')
          .notEqual('')
          .and((message) => message.tempId !== undefined)
          .toArray();

        if (tempMessages.length === 0) return 0;

        // Get all send request message IDs
        const sendRequests = await db.send_message_requests.toArray();
        const activeMessageIds = new Set(sendRequests.map((req) => req.messageId));

        // Find orphaned messages (temp messages without send requests)
        const orphanedMessages = tempMessages.filter(
          (msg) => msg.id && !activeMessageIds.has(msg.id)
        );

        if (orphanedMessages.length > 0) {
          await db.messages.bulkDelete(orphanedMessages.map((m) => m.id));
        }

        return orphanedMessages.length;
      });
    } catch (error) {
      console.error(`Failed to cleanup orphaned temporary messages: ${error}`);
      return 0;
    }
  }

  /**
   * Save or update a draft message for a conversation
   */
  async saveDraftMessage(
    draft: Omit<DraftMessage, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<DraftMessage> {
    try {
      const existingDraft = await db.draft_messages
        .where('[conversationId+userId]')
        .equals([draft.conversationId, draft.userId])
        .first();

      if (existingDraft) {
        const updatedDraft = {
          ...existingDraft,
          content: draft.content,
          updatedAt: new Date(),
        };
        await db.draft_messages.update(existingDraft.id, updatedDraft);
        return updatedDraft;
      }

      const newDraft: DraftMessage = {
        id: `draft_${draft.conversationId}_${draft.userId}_${Date.now()}`,
        ...draft,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await db.draft_messages.add(newDraft);
      return newDraft;
    } catch (error) {
      throw new Error(`Failed to save draft message: ${error}`);
    }
  }

  /**
   * Get draft message for a conversation and user
   */
  async getDraftMessage(conversationId: string, userId: string): Promise<DraftMessage | undefined> {
    try {
      return await db.draft_messages
        .where('[conversationId+userId]')
        .equals([conversationId, userId])
        .first();
    } catch (error) {
      throw new Error(`Failed to get draft message: ${error}`);
    }
  }

  /**
   * Delete draft message for a conversation and user
   */
  async deleteDraftMessage(conversationId: string, userId: string): Promise<void> {
    try {
      const existingDraft = await db.draft_messages
        .where('[conversationId+userId]')
        .equals([conversationId, userId])
        .first();

      if (existingDraft) {
        await db.draft_messages.delete(existingDraft.id);
      }
    } catch (error) {
      throw new Error(`Failed to delete draft message: ${error}`);
    }
  }

  /**
   * Get temporary message statistics for monitoring
   */
  async getTemporaryMessageStats(): Promise<{
    total: number;
    sending: number;
    failed: number;
    oldestAge: number | null;
  }> {
    try {
      const tempMessages = await db.messages
        .where('tempId')
        .notEqual('')
        .and((message) => message.tempId !== undefined)
        .toArray();

      const sending = tempMessages.filter((m) => m.status === 'sending').length;
      const failed = tempMessages.filter((m) => m.status === 'failed').length;

      const oldestAge =
        tempMessages.length > 0
          ? Math.max(...tempMessages.map((m) => Date.now() - ensureDate(m.createdAt).getTime()))
          : null;

      return {
        total: tempMessages.length,
        sending,
        failed,
        oldestAge,
      };
    } catch (error) {
      console.error(`Failed to get temporary message stats: ${error}`);
      return { total: 0, sending: 0, failed: 0, oldestAge: null };
    }
  }

  /**
   * Clear all data from the database
   */
  async clearAllData(): Promise<void> {
    try {
      await db.transaction(
        'rw',
        [
          db.users,
          db.conversations,
          db.messages,
          db.conversation_participants,
          db.draft_messages,
          db.send_message_requests,
          db.sequence_counters,
          db.pagination_metadata,
        ],
        async () => {
          await db.users.clear();
          await db.conversations.clear();
          await db.messages.clear();
          await db.conversation_participants.clear();
          await db.draft_messages.clear();
          await db.send_message_requests.clear();
          await db.sequence_counters.clear();
          await db.pagination_metadata.clear();
        }
      );
    } catch (error) {
      throw new Error(`Failed to clear all data: ${error}`);
    }
  }
}

export const dbOps = new DatabaseOperations();
