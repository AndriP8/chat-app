import { z } from "zod";

// User registration schema
export const registerSchema = z.object({
  email: z
    .string()
    .email("Invalid email format")
    .min(1, "Email is required")
    .max(255, "Email must be less than 255 characters"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be less than 128 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain at least one lowercase letter, one uppercase letter, and one number",
    ),
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be less than 100 characters")
    .trim(),
  profilePictureUrl: z
    .string()
    .url("Invalid URL format")
    .optional()
    .or(z.literal(""))
    .transform((val: string | undefined) => (val === "" ? undefined : val)),
});

// User login schema
export const loginSchema = z.object({
  email: z.string().email("Invalid email format").min(1, "Email is required"),
  password: z.string().min(1, "Password is required"),
});

// Type exports for use in routes
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

// Response schemas for consistent API responses
export const userResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  profile_picture_url: z.string().nullable(),
  created_at: z.date(),
  updated_at: z.date(),
});

// Auth response schema
export const authResponseSchema = z.object({
  user: userResponseSchema,
  token: z.string(),
});

export type UserResponse = z.infer<typeof userResponseSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
