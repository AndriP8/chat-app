import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
  uniqueIndex,
  primaryKey,
  integer,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    password_hash: varchar('password_hash', { length: 255 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    profile_picture_url: varchar('profile_picture_url', { length: 500 }),
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    email_idx: index('email_idx').on(table.email),
  })
);

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }),
    created_by: uuid('created_by')
      .references(() => users.id)
      .notNull(),
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    name_idx: index('conversation_name_idx').on(table.name),
    created_by_idx: index('conversation_created_by_idx').on(table.created_by),
  })
);

export const conversationParticipants = pgTable(
  'conversation_participants',
  {
    conversation_id: uuid('conversation_id')
      .references(() => conversations.id, { onDelete: 'cascade' })
      .notNull(),
    user_id: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.conversation_id, table.user_id] }),
    conversation_idx: index('conversation_participants_conversation_idx').on(table.conversation_id),
    user_idx: index('conversation_participants_user_idx').on(table.user_id),
  })
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    content: text('content').notNull(),
    status: varchar('status', { length: 20 }).default('sending').notNull(), // 'sending', 'sent', 'delivered', 'read', 'failed'
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
    sender_id: uuid('sender_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    conversation_id: uuid('conversation_id')
      .references(() => conversations.id, { onDelete: 'cascade' })
      .notNull(),
    sequence_number: integer('sequence_number'),
  },
  (table) => ({
    conversation_idx: index('message_conversation_idx').on(table.conversation_id),
    sender_idx: index('message_sender_idx').on(table.sender_id),
    created_at_idx: index('message_created_at_idx').on(table.created_at),
    status_idx: index('message_status_idx').on(table.status),
    ordering_idx: index('message_ordering_idx').on(
      table.conversation_id,
      table.sender_id,
      table.sequence_number
    ),
    unique_sequence_idx: uniqueIndex('message_unique_sequence_idx').on(
      table.conversation_id,
      table.sender_id,
      table.sequence_number
    ),
  })
);

export const usersRelations = relations(users, ({ many }) => ({
  conversation_participants: many(conversationParticipants),
  messages: many(messages),
  created_conversations: many(conversations),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  creator: one(users, {
    fields: [conversations.created_by],
    references: [users.id],
  }),
  participants: many(conversationParticipants),
  messages: many(messages),
}));

export const conversationParticipantsRelations = relations(conversationParticipants, ({ one }) => ({
  conversation: one(conversations, {
    fields: [conversationParticipants.conversation_id],
    references: [conversations.id],
  }),
  user: one(users, {
    fields: [conversationParticipants.user_id],
    references: [users.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversation_id],
    references: [conversations.id],
  }),
  sender: one(users, {
    fields: [messages.sender_id],
    references: [users.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type ConversationParticipant = typeof conversationParticipants.$inferSelect;
export type NewConversationParticipant = typeof conversationParticipants.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
