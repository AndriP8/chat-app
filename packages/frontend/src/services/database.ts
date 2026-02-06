import Dexie, { type EntityTable } from 'dexie';
import type {
  Conversation,
  ConversationParticipant,
  DatabaseSchema,
  DraftMessage,
  Message,
  PaginationMetadata,
  SendMessageRequest,
  SequenceCounter,
  User,
} from '../types/database';

class ChatDatabase extends Dexie {
  users!: EntityTable<User, 'id'>;
  conversations!: EntityTable<Conversation, 'id'>;
  messages!: EntityTable<Message, 'id'>;
  conversation_participants!: EntityTable<ConversationParticipant, 'conversationId'>;
  draft_messages!: EntityTable<DraftMessage, 'id'>;
  send_message_requests!: EntityTable<SendMessageRequest, 'id'>;
  sequence_counters!: EntityTable<SequenceCounter, 'conversationId' | 'userId'>;
  pagination_metadata!: EntityTable<PaginationMetadata, 'conversationId'>;

  constructor() {
    super('ChatAppDatabase');

    // Version 1 & 2: Old schema with snake_case (kept for migration compatibility)
    this.version(1).stores({
      users: 'id, email, name, created_at',
      conversations: 'id, created_by, created_at, updated_at',
      messages:
        'id, conversation_id, sender_id, status, created_at, tempId, [conversation_id+sender_id+sequence_number]',
      conversation_participants: '[conversation_id+user_id], conversation_id, user_id',
      draft_messages: 'id, conversation_id, user_id, [conversation_id+user_id], updated_at',
      send_message_requests: 'id, message_id, status, created_at, last_sent_at',
      sequence_counters: '[conversation_id+user_id], conversation_id, user_id, updated_at',
      pagination_metadata: 'conversation_id, updated_at',
    });

    // Version 3: New schema with camelCase
    this.version(3)
      .stores({
        users: 'id, email, name, createdAt',
        conversations: 'id, createdBy, createdAt, updatedAt',
        messages:
          'id, conversationId, senderId, status, createdAt, tempId, [conversationId+senderId+sequenceNumber]',
        conversation_participants: '[conversationId+userId], conversationId, userId',
        draft_messages: 'id, conversationId, userId, [conversationId+userId], updatedAt',
        send_message_requests: 'id, messageId, status, createdAt, lastSentAt',
        sequence_counters: '[conversationId+userId], conversationId, userId, updatedAt',
        pagination_metadata: 'conversationId, updatedAt',
      })
      .upgrade(async (tx) => {
        // Migrate users table
        type OldUser = Partial<{
          created_at: Date;
          updated_at: Date;
          profile_picture_url: string;
          is_demo: boolean;
          password_hash: string;
        }> &
          Partial<User>;

        await tx
          .table('users')
          .toCollection()
          .modify((user: OldUser) => {
            if (user.created_at) {
              user.createdAt = user.created_at;
              delete user.created_at;
            }
            if (user.updated_at) {
              user.updatedAt = user.updated_at;
              delete user.updated_at;
            }
            if (user.profile_picture_url !== undefined) {
              user.profilePictureUrl = user.profile_picture_url;
              delete user.profile_picture_url;
            }
            if (user.is_demo !== undefined) {
              user.isDemo = user.is_demo;
              delete user.is_demo;
            }
            if (user.password_hash !== undefined) {
              user.passwordHash = user.password_hash;
              delete user.password_hash;
            }
          });

        // Migrate conversations table
        type OldConversation = Partial<{
          created_by: string;
          created_at: Date;
          updated_at: Date;
        }> &
          Partial<Conversation>;

        await tx
          .table('conversations')
          .toCollection()
          .modify((conversation: OldConversation) => {
            if (conversation.created_by) {
              conversation.createdBy = conversation.created_by;
              delete conversation.created_by;
            }
            if (conversation.created_at) {
              conversation.createdAt = conversation.created_at;
              delete conversation.created_at;
            }
            if (conversation.updated_at) {
              conversation.updatedAt = conversation.updated_at;
              delete conversation.updated_at;
            }
          });

        // Migrate messages table
        type OldMessage = Partial<{
          conversation_id: string;
          sender_id: string;
          created_at: Date;
          updated_at: Date;
          sequence_number: number;
        }> &
          Partial<Message>;

        await tx
          .table('messages')
          .toCollection()
          .modify((message: OldMessage) => {
            if (message.conversation_id) {
              message.conversationId = message.conversation_id;
              delete message.conversation_id;
            }
            if (message.sender_id) {
              message.senderId = message.sender_id;
              delete message.sender_id;
            }
            if (message.created_at) {
              message.createdAt = message.created_at;
              delete message.created_at;
            }
            if (message.updated_at) {
              message.updatedAt = message.updated_at;
              delete message.updated_at;
            }
            if (message.sequence_number !== undefined) {
              message.sequenceNumber = message.sequence_number;
              delete message.sequence_number;
            }
          });

        // Migrate conversation_participants table
        type OldParticipant = Partial<{
          conversation_id: string;
          user_id: string;
        }> &
          Partial<ConversationParticipant>;

        await tx
          .table('conversation_participants')
          .toCollection()
          .modify((participant: OldParticipant) => {
            if (participant.conversation_id) {
              participant.conversationId = participant.conversation_id;
              delete participant.conversation_id;
            }
            if (participant.user_id) {
              participant.userId = participant.user_id;
              delete participant.user_id;
            }
          });

        // Migrate draft_messages table
        type OldDraft = Partial<{
          conversation_id: string;
          user_id: string;
          created_at: Date;
          updated_at: Date;
        }> &
          Partial<DraftMessage>;

        await tx
          .table('draft_messages')
          .toCollection()
          .modify((draft: OldDraft) => {
            if (draft.conversation_id) {
              draft.conversationId = draft.conversation_id;
              delete draft.conversation_id;
            }
            if (draft.user_id) {
              draft.userId = draft.user_id;
              delete draft.user_id;
            }
            if (draft.created_at) {
              draft.createdAt = draft.created_at;
              delete draft.created_at;
            }
            if (draft.updated_at) {
              draft.updatedAt = draft.updated_at;
              delete draft.updated_at;
            }
          });

        // Migrate send_message_requests table
        type OldRequest = Partial<{
          message_id: string;
          last_sent_at: Date;
          retry_count: number;
          error_message: string;
          created_at: Date;
        }> &
          Partial<SendMessageRequest>;

        await tx
          .table('send_message_requests')
          .toCollection()
          .modify((request: OldRequest) => {
            if (request.message_id) {
              request.messageId = request.message_id;
              delete request.message_id;
            }
            if (request.last_sent_at !== undefined) {
              request.lastSentAt = request.last_sent_at;
              delete request.last_sent_at;
            }
            if (request.retry_count !== undefined) {
              request.retryCount = request.retry_count;
              delete request.retry_count;
            }
            if (request.error_message !== undefined) {
              request.errorMessage = request.error_message;
              delete request.error_message;
            }
            if (request.created_at) {
              request.createdAt = request.created_at;
              delete request.created_at;
            }
          });

        // Migrate sequence_counters table
        type OldCounter = Partial<{
          conversation_id: string;
          user_id: string;
          next_sequence: number;
          updated_at: Date;
        }> &
          Partial<SequenceCounter>;

        await tx
          .table('sequence_counters')
          .toCollection()
          .modify((counter: OldCounter) => {
            if (counter.conversation_id) {
              counter.conversationId = counter.conversation_id;
              delete counter.conversation_id;
            }
            if (counter.user_id) {
              counter.userId = counter.user_id;
              delete counter.user_id;
            }
            if (counter.next_sequence !== undefined) {
              counter.nextSequence = counter.next_sequence;
              delete counter.next_sequence;
            }
            if (counter.updated_at) {
              counter.updatedAt = counter.updated_at;
              delete counter.updated_at;
            }
          });

        // Migrate pagination_metadata table
        type OldMetadata = Partial<{
          conversation_id: string;
          has_more: boolean;
          next_cursor: string;
          last_message_id: string;
          updated_at: Date;
        }> &
          Partial<PaginationMetadata>;

        await tx
          .table('pagination_metadata')
          .toCollection()
          .modify((metadata: OldMetadata) => {
            if (metadata.conversation_id) {
              metadata.conversationId = metadata.conversation_id;
              delete metadata.conversation_id;
            }
            if (metadata.has_more !== undefined) {
              metadata.hasMore = metadata.has_more;
              delete metadata.has_more;
            }
            if (metadata.next_cursor !== undefined) {
              metadata.nextCursor = metadata.next_cursor;
              delete metadata.next_cursor;
            }
            if (metadata.last_message_id !== undefined) {
              metadata.lastMessageId = metadata.last_message_id;
              delete metadata.last_message_id;
            }
            if (metadata.updated_at) {
              metadata.updatedAt = metadata.updated_at;
              delete metadata.updated_at;
            }
          });
      });

    // Add hooks for automatic timestamp updates (using camelCase)
    this.users.hook('creating', (_primKey, obj, _trans) => {
      if (!obj.createdAt) obj.createdAt = new Date();
      if (!obj.updatedAt) obj.updatedAt = new Date();
    });

    this.users.hook('updating', (modifications, _primKey, _obj, _trans) => {
      const mods = modifications as Partial<User>;
      if (!mods.updatedAt) mods.updatedAt = new Date();
    });

    this.conversations.hook('creating', (_primKey, obj, _trans) => {
      if (!obj.createdAt) obj.createdAt = new Date();
      if (!obj.updatedAt) obj.updatedAt = new Date();
    });

    this.conversations.hook('updating', (modifications, _primKey, _obj, _trans) => {
      const mods = modifications as Partial<Conversation>;
      if (!mods.updatedAt) mods.updatedAt = new Date();
    });

    this.messages.hook('creating', (_primKey, obj, _trans) => {
      if (!obj.createdAt) obj.createdAt = new Date();
      if (!obj.updatedAt) obj.updatedAt = new Date();
    });

    this.messages.hook('updating', (modifications, _primKey, _obj, _trans) => {
      const mods = modifications as Partial<Message>;
      if (!mods.updatedAt) mods.updatedAt = new Date();
    });

    this.draft_messages.hook('creating', (_primKey, obj, _trans) => {
      obj.createdAt = new Date();
      obj.updatedAt = new Date();
    });

    this.draft_messages.hook('updating', (modifications, _primKey, _obj, _trans) => {
      (modifications as Partial<DraftMessage>).updatedAt = new Date();
    });

    this.send_message_requests.hook('creating', (_primKey, obj, _trans) => {
      obj.createdAt = new Date();
    });

    this.sequence_counters.hook('creating', (_primKey, obj, _trans) => {
      if (!obj.updatedAt) obj.updatedAt = new Date();
    });

    this.sequence_counters.hook('updating', (modifications, _primKey, _obj, _trans) => {
      const mods = modifications as Partial<SequenceCounter>;
      if (!mods.updatedAt) mods.updatedAt = new Date();
    });

    this.pagination_metadata.hook('creating', (_primKey, obj, _trans) => {
      if (!obj.updatedAt) obj.updatedAt = new Date();
    });

    this.pagination_metadata.hook('updating', (modifications, _primKey, _obj, _trans) => {
      const mods = modifications as Partial<PaginationMetadata>;
      if (!mods.updatedAt) mods.updatedAt = new Date();
    });
  }

  async clearAllData(): Promise<void> {
    await this.transaction('rw', this.tables, async () => {
      await Promise.all(this.tables.map((table) => table.clear()));
    });
  }

  async getDatabaseInfo(): Promise<{
    tables: Record<string, number>;
    totalRecords: number;
  }> {
    const tables: Record<string, number> = {};
    let totalRecords = 0;

    for (const table of this.tables) {
      const count = await table.count();
      tables[table.name] = count;
      totalRecords += count;
    }

    return { tables, totalRecords };
  }
}

export const db = new ChatDatabase();

export { ChatDatabase };

export type { DatabaseSchema };
