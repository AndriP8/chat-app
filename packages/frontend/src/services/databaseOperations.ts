import { db } from './database';
import type {
  User,
  Conversation,
  Message,
  ConversationParticipant,
  SendMessageRequest,
} from '../types/database';
import { ensureDate } from '@/utils/helpers';

export class DatabaseOperations {
  get db() {
    return db;
  }
  // ===== USER OPERATIONS =====
  async upsertUser(user: Omit<User, 'created_at' | 'updated_at'>): Promise<User> {
    try {
      const existingUser = await db.users.get(user.id);
      if (existingUser) {
        await db.users.update(user.id, user);
        return { ...existingUser, ...user, updated_at: new Date() };
      }
      const newUser = { ...user, created_at: new Date(), updated_at: new Date() };
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
        return { ...existingConversation, ...conversation, updated_at: new Date() };
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
      // Get all messages for these conversations in one query, sorted by created_at desc
      const allMessages = await db.messages
        .where('conversation_id')
        .equals(conversationId)
        .reverse()
        .sortBy('created_at');

      const lastMessage = allMessages[0];
      if (!lastMessage) {
        return null;
      }

      const sender = await this.getUser(lastMessage.sender_id);
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
      Conversation & { participants: User[]; last_message: (Message & { sender: User }) | null }
    >
  > {
    try {
      const conversationUser: ConversationParticipant | undefined =
        await db.conversation_participants.where('user_id').equals(userId).first();

      if (!conversationUser) {
        return [];
      }

      const conversationId = conversationUser.conversation_id;

      const [conversations, allParticipantRecords, lastMessage] = await Promise.all([
        // Get conversations
        db.conversations
          .where('id')
          .equals(conversationId)
          .toArray(),

        // Get all conversation participants
        db.conversation_participants
          .where('conversation_id')
          .equals(conversationId)
          .toArray(),

        // Get last message for each conversation
        this.getLastMessagesByConversation(conversationId),
      ]);

      const userIds = allParticipantRecords.map((p) => p.user_id);
      const users = await this.getUsers(userIds);
      const userMap = new Map(users.map((u) => [u.id, u]));

      const participants = allParticipantRecords.reduce<User[]>((acc, p) => {
        const user = userMap.get(p.user_id);
        if (user) acc.push(user);
        return acc;
      }, []);

      return conversations.map((conversation) => ({
        ...conversation,
        participants,
        last_message: lastMessage,
      }));
    } catch (error) {
      throw new Error(`Failed to get user conversations: ${error}`);
    }
  }

  // ===== MESSAGE OPERATIONS =====
  async upsertMessage(
    message: Partial<Message> &
      Pick<Message, 'id' | 'content' | 'status' | 'sender_id' | 'conversation_id'>
  ): Promise<Message> {
    try {
      const existingMessage = await db.messages.get(message.id);
      if (existingMessage) {
        const updatedMessage = {
          ...existingMessage,
          ...message,
          created_at: ensureDate(existingMessage.created_at),
          updated_at: message.updated_at ? ensureDate(message.updated_at) : new Date(),
        };
        await db.messages.update(message.id, updatedMessage);
        return updatedMessage;
      }

      const newMessage: Message = {
        ...message,
        created_at: message.created_at ? ensureDate(message.created_at) : new Date(),
        updated_at: message.updated_at ? ensureDate(message.updated_at) : new Date(),
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
      Pick<Message, 'id' | 'content' | 'status' | 'sender_id' | 'conversation_id'>
  ): Promise<Message> {
    try {
      return await db.transaction('rw', [db.messages], async () => {
        const existingMessage = await db.messages.where('tempId').equals(tempId).first();

        if (existingMessage) {
          await db.messages.delete(existingMessage.id);
        }

        const newMessage: Message = {
          ...serverMessage,
          created_at: serverMessage.created_at || new Date(),
          updated_at: serverMessage.updated_at || new Date(),
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
      before?: Date;
      after?: Date;
    } = {}
  ): Promise<Message[]> {
    try {
      const { limit = 50, before, after } = options;

      let query = db.messages.where('conversation_id').equals(conversationId);

      if (before) {
        query = query.and((message) => ensureDate(message.created_at) < before);
      }

      if (after) {
        query = query.and((message) => ensureDate(message.created_at) > after);
      }

      const messages = await query.toArray();
      // Reverse sorting to get messages in chronological order
      return messages
        .sort((a, b) => ensureDate(a.created_at).getTime() - ensureDate(b.created_at).getTime())
        .slice(0, limit);
    } catch (error) {
      throw new Error(`Failed to get conversation messages: ${error}`);
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
        .where('[conversation_id+user_id]')
        .equals([participant.conversation_id, participant.user_id])
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
    request: Omit<SendMessageRequest, 'id' | 'created_at'>
  ): Promise<SendMessageRequest> {
    try {
      const id = `${request.message_id}_${Date.now()}`;
      const newRequest: SendMessageRequest = {
        ...request,
        id,
        created_at: new Date(),
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
        (a, b) => ensureDate(a.created_at).getTime() - ensureDate(b.created_at).getTime()
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
        last_sent_at: new Date(),
      };

      if (status === 'failed') {
        const request = await db.send_message_requests.get(requestId);
        if (request) {
          updates.retry_count = request.retry_count + 1;
          updates.error_message = errorMessage;
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
      return await db.send_message_requests.where('message_id').equals(messageId).first();
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
      return await db.send_message_requests.where('status').equals(status).toArray();
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
            (message) => message.tempId !== undefined && ensureDate(message.created_at) < cutoffTime
          )
          .toArray();

        if (failedMessages.length > 0) {
          await db.messages.bulkDelete(failedMessages.map((m) => m.id));
          console.log(`Cleaned up ${failedMessages.length} failed temporary messages`);
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
        const activeMessageIds = new Set(sendRequests.map((req) => req.message_id));

        // Find orphaned messages (temp messages without send requests)
        const orphanedMessages = tempMessages.filter(
          (msg) => msg.id && !activeMessageIds.has(msg.id)
        );

        if (orphanedMessages.length > 0) {
          await db.messages.bulkDelete(orphanedMessages.map((m) => m.id));
          console.log(`Cleaned up ${orphanedMessages.length} orphaned temporary messages`);
        }

        return orphanedMessages.length;
      });
    } catch (error) {
      console.error(`Failed to cleanup orphaned temporary messages: ${error}`);
      return 0;
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
          ? Math.max(...tempMessages.map((m) => Date.now() - ensureDate(m.created_at).getTime()))
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
        ],
        async () => {
          await db.users.clear();
          await db.conversations.clear();
          await db.messages.clear();
          await db.conversation_participants.clear();
          await db.draft_messages.clear();
          await db.send_message_requests.clear();
        }
      );
    } catch (error) {
      throw new Error(`Failed to clear all data: ${error}`);
    }
  }
}

export const dbOps = new DatabaseOperations();
