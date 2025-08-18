export type {
  User,
  Conversation,
  Message,
} from './database';

export type {
  Message as ChatMessage,
  ChatRoom,
} from './chat';

// Validation types
export interface ValidationError {
  field: string;
  message: string;
}
