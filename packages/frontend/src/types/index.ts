export type {
  ChatRoom,
  Message as ChatMessage,
} from './chat';
export type {
  Conversation,
  Message,
  User,
} from './database';

// Validation types
export interface ValidationError {
  field: string;
  message: string;
}
