import { type LoginInput, loginSchema } from '@/schemas/auth';
import { makeRequest } from './base';
import type { AuthResponse, DemoUsersResponse, MessageResponse, UserResponse } from './types/auth';

/**
 * Authentication API endpoints
 */
export const authApi = {
  /**
   * Login user
   */
  async login(loginData: LoginInput): Promise<AuthResponse> {
    // Validate input data
    const validatedData = loginSchema.parse(loginData);

    return makeRequest<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(validatedData),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  },

  /**
   * Get current user information
   */
  async getCurrentUser(): Promise<UserResponse> {
    return makeRequest<UserResponse>('/auth/me');
  },

  /**
   * Logout user (optional - mainly for consistency)
   */
  async logout(): Promise<MessageResponse> {
    return makeRequest<MessageResponse>('/auth/logout', {
      method: 'POST',
    });
  },

  /**
   * Generate demo user pair
   */
  async generateDemoUser(): Promise<DemoUsersResponse> {
    return makeRequest<DemoUsersResponse>('/auth/demo-user', {
      method: 'POST',
    });
  },
};
