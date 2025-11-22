export interface User {
  id: string;
  email: string;
  password_hash?: string;
  name: string;
  profile_picture_url?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Conversation {
  id: string;
  name?: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface Message {
  id: string;
  content: string;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  created_at: Date;
  updated_at: Date;
  sender_id: string;
  conversation_id: string;
  tempId?: string;
  sequence_number?: number;
}

export interface ConversationParticipant {
  conversation_id: string;
  user_id: string;
}

// Client-side only entities (not synced to server)
export interface DraftMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  content: string;
  created_at: Date;
  updated_at: Date;
}

export interface SendMessageRequest {
  id: string;
  message_id: string;
  status: 'pending' | 'in_flight' | 'failed';
  last_sent_at?: Date;
  retry_count: number;
  error_message?: string;
  created_at: Date;
}

export interface SequenceCounter {
  conversation_id: string;
  user_id: string;
  next_sequence: number;
  updated_at: Date;
}

export interface PaginationMetadata {
  conversation_id: string;
  has_more: boolean;
  next_cursor: string | null;
  last_message_id: string | null;
  updated_at: Date;
}

// Database schema types for Dexie
export interface DatabaseSchema {
  users: User;
  conversations: Conversation;
  messages: Message;
  conversation_participants: ConversationParticipant;
  draft_messages: DraftMessage;
  send_message_requests: SendMessageRequest;
  sequence_counters: SequenceCounter;
  pagination_metadata: PaginationMetadata;
}
