import { z } from 'zod';

// User login schema
export const loginSchema = z.object({
  email: z.string().email('Invalid email format').min(1, 'Email is required'),
  password: z.string().min(1, 'Password is required'),
});

// Type exports for use in components
export type LoginInput = z.infer<typeof loginSchema>;

// Response schemas for API responses
export const userResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  profilePictureUrl: z.string().nullable(),
  createdAt: z.string().transform((val) => new Date(val)),
  updatedAt: z.string().transform((val) => new Date(val)),
});

export const authResponseSchema = z.object({
  user: userResponseSchema,
  token: z.string(),
});

export type UserResponse = z.infer<typeof userResponseSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
