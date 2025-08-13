import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table
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

// Conversations table
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

// Conversation participants table
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

// Messages table
export const messages = pgTable(
  'messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    content: text('content').notNull(),
    status: varchar('status', { length: 20 }).default('sent').notNull(), // 'sent', 'delivered', 'read', 'failed'
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
    sender_id: uuid('sender_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    conversation_id: uuid('conversation_id')
      .references(() => conversations.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => ({
    conversation_idx: index('message_conversation_idx').on(table.conversation_id),
    sender_idx: index('message_sender_idx').on(table.sender_id),
    created_at_idx: index('message_created_at_idx').on(table.created_at),
    status_idx: index('message_status_idx').on(table.status),
  })
);

// Draft messages table
export const draftMessages = pgTable(
  'draft_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    content: text('content').notNull(),
    conversation_id: uuid('conversation_id')
      .references(() => conversations.id, { onDelete: 'cascade' })
      .notNull(),
    user_id: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    conversation_idx: index('draft_message_conversation_idx').on(table.conversation_id),
    user_idx: index('draft_message_user_idx').on(table.user_id),
    conversation_user_idx: index('draft_message_conversation_user_idx').on(
      table.conversation_id,
      table.user_id
    ),
  })
);

// Send message requests table
export const sendMessageRequests = pgTable(
  'send_message_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    message_id: uuid('message_id')
      .references(() => messages.id, { onDelete: 'cascade' })
      .notNull(),
    status: varchar('status', { length: 20 }).default('pending').notNull(), // 'pending', 'in_flight', 'failed'
    last_sent_at: timestamp('last_sent_at'),
    retry_count: integer('retry_count').default(0).notNull(),
    error_message: text('error_message'),
    created_at: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    message_idx: index('send_message_request_message_idx').on(table.message_id),
    status_idx: index('send_message_request_status_idx').on(table.status),
    last_sent_at_idx: index('send_message_request_last_sent_at_idx').on(table.last_sent_at),
  })
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  conversation_participants: many(conversationParticipants),
  messages: many(messages),
  created_conversations: many(conversations),
  draft_messages: many(draftMessages),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  creator: one(users, {
    fields: [conversations.created_by],
    references: [users.id],
  }),
  participants: many(conversationParticipants),
  messages: many(messages),
  draft_messages: many(draftMessages),
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

export const messagesRelations = relations(messages, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [messages.conversation_id],
    references: [conversations.id],
  }),
  sender: one(users, {
    fields: [messages.sender_id],
    references: [users.id],
  }),
  send_message_requests: many(sendMessageRequests),
}));

export const draftMessagesRelations = relations(draftMessages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [draftMessages.conversation_id],
    references: [conversations.id],
  }),
  user: one(users, {
    fields: [draftMessages.user_id],
    references: [users.id],
  }),
}));

export const sendMessageRequestsRelations = relations(sendMessageRequests, ({ one }) => ({
  message: one(messages, {
    fields: [sendMessageRequests.message_id],
    references: [messages.id],
  }),
}));

// Export types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type ConversationParticipant = typeof conversationParticipants.$inferSelect;
export type NewConversationParticipant = typeof conversationParticipants.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type DraftMessage = typeof draftMessages.$inferSelect;
export type NewDraftMessage = typeof draftMessages.$inferInsert;
export type SendMessageRequest = typeof sendMessageRequests.$inferSelect;
export type NewSendMessageRequest = typeof sendMessageRequests.$inferInsert;
