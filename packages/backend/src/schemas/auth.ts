import { z } from 'zod';

// User login schema
export const loginSchema = z.object({
  email: z.string().email('Invalid email format').min(1, 'Email is required'),
  password: z.string().min(1, 'Password is required'),
});

// Type exports for use in routes
export type LoginInput = z.infer<typeof loginSchema>;

// Response schemas for consistent API responses
export const userResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  profilePictureUrl: z.string().nullable(),
  isDemo: z.boolean().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Auth response schema
export const authResponseSchema = z.object({
  user: userResponseSchema,
  token: z.string(),
});

export type UserResponse = z.infer<typeof userResponseSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
