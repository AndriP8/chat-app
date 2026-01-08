import { z } from 'zod';

export const messageStatusEnum = z.enum(['sending', 'sent', 'delivered', 'read', 'failed']);

export const getMessagesSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  nextCursor: z.string().uuid().optional(),
});

export const sendMessageSchema = z.object({
  conversationId: z.string().uuid('Invalid conversation ID format'),
  content: z.string().min(1).max(5000, 'Message content too long'),
  tempId: z.string().min(1, 'Temporary ID is required'),
  sequenceNumber: z.number().int().positive().optional(),
  createdAt: z.string().datetime().optional(),
});

export const userResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  profilePictureUrl: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const messageResponseSchema = z.object({
  id: z.string(),
  content: z.string(),
  status: messageStatusEnum,
  senderId: z.string(),
  conversationId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  sender: userResponseSchema.omit({ createdAt: true, updatedAt: true }),
  tempId: z.string().optional(),
  sequenceNumber: z.number().int().positive().optional(),
});

export const conversationResponseSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  createdBy: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  participants: z.array(userResponseSchema),
  lastMessage: messageResponseSchema.nullable(),
});

export type GetMessagesQuery = z.infer<typeof getMessagesSchema>;
export type UserResponse = z.infer<typeof userResponseSchema>;
export type MessageResponse = z.infer<typeof messageResponseSchema>;
export type ConversationResponse = z.infer<typeof conversationResponseSchema>;
export type MessageStatusEnum = z.infer<typeof messageStatusEnum>;
