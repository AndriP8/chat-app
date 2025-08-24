import { z } from 'zod';

export const getMessagesSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  before: z.string().uuid().optional(),
});

export const sendMessageSchema = z.object({
  conversationId: z.string().uuid('Invalid conversation ID format'),
  content: z.string().min(1).max(5000, 'Message content too long'),
  tempId: z.string().min(1, 'Temporary ID is required'),
});
// Response schemas
export const userResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  profile_picture_url: z.string().nullable(),
  created_at: z.date(),
  updated_at: z.date(),
});

export const messageResponseSchema = z.object({
  id: z.string(),
  content: z.string(),
  status: z.enum(['sending', 'sent', 'delivered', 'read', 'failed']),
  sender_id: z.string(),
  conversation_id: z.string(),
  created_at: z.date(),
  updated_at: z.date(),
  sender: userResponseSchema.omit({ created_at: true, updated_at: true }),
  tempId: z.string().optional(),
});

export const conversationResponseSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  created_by: z.string(),
  created_at: z.date(),
  updated_at: z.date(),
  participants: z.array(userResponseSchema),
  last_message: messageResponseSchema.nullable(),
});

// Type exports
export type GetMessagesQuery = z.infer<typeof getMessagesSchema>;
export type UserResponse = z.infer<typeof userResponseSchema>;
export type MessageResponse = z.infer<typeof messageResponseSchema>;
export type ConversationResponse = z.infer<typeof conversationResponseSchema>;
