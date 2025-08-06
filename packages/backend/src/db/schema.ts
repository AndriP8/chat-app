import { pgTable, uuid, varchar, text, timestamp, integer, index, primaryKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  profilePictureUrl: varchar('profile_picture_url', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  emailIdx: index('email_idx').on(table.email),
}));

// Conversations table
export const conversations = pgTable('conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  nameIdx: index('conversation_name_idx').on(table.name),
  createdByIdx: index('conversation_created_by_idx').on(table.createdBy),
}));

// Conversation participants table
export const conversationParticipants = pgTable('conversation_participants', {
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.conversationId, table.userId] }),
  conversationIdx: index('conversation_participants_conversation_idx').on(table.conversationId),
  userIdx: index('conversation_participants_user_idx').on(table.userId),
}));

// Messages table
export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  content: text('content').notNull(),
  status: varchar('status', { length: 20 }).default('sent').notNull(), // 'sent', 'delivered', 'read', 'failed'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  senderId: uuid('sender_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }).notNull(),
}, (table) => ({
  conversationIdx: index('message_conversation_idx').on(table.conversationId),
  senderIdx: index('message_sender_idx').on(table.senderId),
  createdAtIdx: index('message_created_at_idx').on(table.createdAt),
  statusIdx: index('message_status_idx').on(table.status),
}));

// Draft messages table
export const draftMessages = pgTable('draft_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  content: text('content').notNull(),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  conversationIdx: index('draft_message_conversation_idx').on(table.conversationId),
  userIdx: index('draft_message_user_idx').on(table.userId),
  conversationUserIdx: index('draft_message_conversation_user_idx').on(table.conversationId, table.userId),
}));

// Send message requests table
export const sendMessageRequests = pgTable('send_message_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  messageId: uuid('message_id').references(() => messages.id, { onDelete: 'cascade' }).notNull(),
  status: varchar('status', { length: 20 }).default('pending').notNull(), // 'pending', 'in_flight', 'failed'
  lastSentAt: timestamp('last_sent_at'),
  retryCount: integer('retry_count').default(0).notNull(),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  messageIdx: index('send_message_request_message_idx').on(table.messageId),
  statusIdx: index('send_message_request_status_idx').on(table.status),
  lastSentAtIdx: index('send_message_request_last_sent_at_idx').on(table.lastSentAt),
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  conversationParticipants: many(conversationParticipants),
  messages: many(messages),
  createdConversations: many(conversations),
  draftMessages: many(draftMessages),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  creator: one(users, {
    fields: [conversations.createdBy],
    references: [users.id],
  }),
  participants: many(conversationParticipants),
  messages: many(messages),
  draftMessages: many(draftMessages),
}));

export const conversationParticipantsRelations = relations(conversationParticipants, ({ one }) => ({
  conversation: one(conversations, {
    fields: [conversationParticipants.conversationId],
    references: [conversations.id],
  }),
  user: one(users, {
    fields: [conversationParticipants.userId],
    references: [users.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
  sendMessageRequests: many(sendMessageRequests),
}));

export const draftMessagesRelations = relations(draftMessages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [draftMessages.conversationId],
    references: [conversations.id],
  }),
  user: one(users, {
    fields: [draftMessages.userId],
    references: [users.id],
  }),
}));

export const sendMessageRequestsRelations = relations(sendMessageRequests, ({ one }) => ({
  message: one(messages, {
    fields: [sendMessageRequests.messageId],
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