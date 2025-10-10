import Dexie, { type EntityTable } from 'dexie';
import type {
  User,
  Conversation,
  Message,
  ConversationParticipant,
  DraftMessage,
  SendMessageRequest,
  DatabaseSchema,
} from '../types/database';

class ChatDatabase extends Dexie {
  users!: EntityTable<User, 'id'>;
  conversations!: EntityTable<Conversation, 'id'>;
  messages!: EntityTable<Message, 'id'>;
  conversation_participants!: EntityTable<ConversationParticipant, 'conversation_id'>;
  draft_messages!: EntityTable<DraftMessage, 'id'>;
  send_message_requests!: EntityTable<SendMessageRequest, 'id'>;

  constructor() {
    super('ChatAppDatabase');

    this.version(1).stores({
      users: 'id, email, name, created_at',
      conversations: 'id, created_by, created_at, updated_at',
      messages: 'id, conversation_id, sender_id, status, created_at, tempId',
      conversation_participants: '[conversation_id+user_id], conversation_id, user_id',
      draft_messages: 'id, conversation_id, user_id, [conversation_id+user_id], updated_at',
      send_message_requests: 'id, message_id, status, created_at, last_sent_at',
    });

    // Add hooks for automatic timestamp updates
    this.users.hook('creating', (_primKey, obj, _trans) => {
      if (!obj.created_at) obj.created_at = new Date();
      if (!obj.updated_at) obj.updated_at = new Date();
    });

    this.users.hook('updating', (modifications, _primKey, _obj, _trans) => {
      const mods = modifications as Partial<User>;
      if (!mods.updated_at) mods.updated_at = new Date();
    });

    this.conversations.hook('creating', (_primKey, obj, _trans) => {
      if (!obj.created_at) obj.created_at = new Date();
      if (!obj.updated_at) obj.updated_at = new Date();
    });

    this.conversations.hook('updating', (modifications, _primKey, _obj, _trans) => {
      const mods = modifications as Partial<Conversation>;
      if (!mods.updated_at) mods.updated_at = new Date();
    });

    this.messages.hook('creating', (_primKey, obj, _trans) => {
      if (!obj.created_at) obj.created_at = new Date();
      if (!obj.updated_at) obj.updated_at = new Date();
    });

    this.messages.hook('updating', (modifications, _primKey, _obj, _trans) => {
      const mods = modifications as Partial<Message>;
      if (!mods.updated_at) mods.updated_at = new Date();
    });

    this.draft_messages.hook('creating', (_primKey, obj, _trans) => {
      obj.created_at = new Date();
      obj.updated_at = new Date();
    });

    this.draft_messages.hook('updating', (modifications, _primKey, _obj, _trans) => {
      (modifications as Partial<DraftMessage>).updated_at = new Date();
    });

    this.send_message_requests.hook('creating', (_primKey, obj, _trans) => {
      obj.created_at = new Date();
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
