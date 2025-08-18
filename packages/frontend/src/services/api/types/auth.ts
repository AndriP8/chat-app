import type { User } from '@/types';

export interface AuthResponse {
  data: {
    user: User;
  };
  token: string;
}

export interface UserResponse {
  user: User;
}

export interface MessageResponse {
  message: string;
}
