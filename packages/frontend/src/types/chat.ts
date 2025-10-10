import type { User, Message as DatabaseMessage } from './database';

export interface Message extends DatabaseMessage {
  sender: User;
}

// Extended message type for UI state management
export interface UIMessage extends Message {
  // UI-specific fields for optimistic updates
  tempId?: string;
  isTemporary?: boolean;
  error?: string;
  retryCount?: number;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  lastRetryAt?: Date;
}

export interface ChatRoom {
  id: string;
  name: string | null;
  created_by: string;
  participants: User[];
  last_message?: Message | null;
  created_at: string;
  updated_at: string;
}

// API Request/Response types
export interface CreateConversationRequest {
  participantId: string;
  name?: string;
}

export interface SendMessageRequest {
  conversationId: string;
  content: string;
  tempId: string;
}

export interface GetMessagesQuery {
  limit?: number;
  before?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  details?: Record<string, string[]>;
}

// Backend response types (wrapped in data property)
export type ConversationsResponse = {
  data: ChatRoom[];
  hasMore: boolean;
};

export type ConversationResponse = ChatRoom;

export interface MessagesResponse {
  data: Message[];
  hasMore: boolean;
}

export type MessageResponse = Message;

// Enhanced state for useConversations hook
export interface ConversationsState {
  conversations: ChatRoom[];
  hasMore: boolean;
  messages: Record<string, UIMessage[]>;
  loading: {
    conversations: boolean;
    messages: Record<string, boolean>;
  };
  errors: {
    conversations?: string;
    messages?: Record<string, string>;
    send?: string;
    create?: string;
  };
}

export type ConversationsAction =
  | { type: 'SET_CONVERSATIONS'; payload: ChatRoom[] }
  | { type: 'SET_MESSAGES'; payload: { conversationId: string; messages: UIMessage[] } }
  | { type: 'ADD_MESSAGE'; payload: { conversationId: string; message: UIMessage } }
  | {
      type: 'UPDATE_MESSAGE';
      payload: { conversationId: string; messageId: string; updates: Partial<UIMessage> };
    }
  | { type: 'REMOVE_MESSAGE'; payload: { conversationId: string; messageId: string } }
  | {
      type: 'SET_LOADING';
      payload: {
        type: keyof ConversationsState['loading'];
        loading: boolean;
        conversationId?: string;
      };
    }
  | {
      type: 'SET_ERROR';
      payload: {
        type: keyof ConversationsState['errors'];
        error: string | undefined;
        conversationId?: string;
      };
    }
  | {
      type: 'CLEAR_ERROR';
      payload: { type: keyof ConversationsState['errors']; conversationId?: string };
    }
  | { type: 'CLEAR_ALL_ERRORS' }
  | {
      type: 'UPDATE_CONVERSATION';
      payload: { conversationId: string; updates: Partial<ChatRoom> };
    }
  | {
      type: 'REPLACE_TEMP_MESSAGE';
      payload: { conversationId: string; tempId: string; message: UIMessage };
    }
  | {
      type: 'REMOVE_TEMP_MESSAGE';
      payload: { conversationId: string; tempId: string };
    };
