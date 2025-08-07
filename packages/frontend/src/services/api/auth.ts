import {
  registerSchema,
  loginSchema,
  type RegisterInput,
  type LoginInput,
} from "@/schemas/auth";
import { makeRequest } from "./base";
import type { AuthResponse, UserResponse, MessageResponse } from "./types/auth";

/**
 * Authentication API endpoints
 */
export const authApi = {
  /**
   * Register a new user
   */
  async register(userData: RegisterInput): Promise<AuthResponse> {
    // Validate input data
    const validatedData = registerSchema.parse(userData);

    return makeRequest<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(validatedData),
    });
  },

  /**
   * Login user
   */
  async login(loginData: LoginInput): Promise<AuthResponse> {
    // Validate input data
    const validatedData = loginSchema.parse(loginData);

    return makeRequest<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(validatedData),
    });
  },

  /**
   * Get current user information
   */
  async getCurrentUser(): Promise<UserResponse> {
    return makeRequest<UserResponse>("/auth/me");
  },

  /**
   * Logout user (optional - mainly for consistency)
   */
  async logout(): Promise<MessageResponse> {
    return makeRequest<MessageResponse>("/auth/logout", {
      method: "POST",
    });
  },
};
