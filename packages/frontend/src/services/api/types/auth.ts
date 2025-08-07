import type { User } from "@/types";

export interface AuthResponse {
  user: User;
  token: string;
}

export interface UserResponse {
  user: User;
}

export interface MessageResponse {
  message: string;
}
