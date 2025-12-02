import type { User } from '@/types';

export interface AuthResponse {
  data: {
    user: User;
  };
  token: string;
}

export interface DemoUser {
  id: string;
  email: string;
  name: string;
}

export interface DemoUsersResponse {
  data: {
    users: DemoUser[];
    password: string;
    conversationId: string;
  };
}

export interface UserResponse {
  data: {
    user: User;
  };
}

export interface MessageResponse {
  message: string;
}
