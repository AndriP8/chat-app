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
}

export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  joined_at: Date;
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
  conversation_id: string;
  content: string;
  temp_id: string;
  status: 'pending' | 'in_flight' | 'fail' | 'success';
  fail_count: number;
  created_at: Date;
  updated_at: Date;
  last_attempt_at?: Date;
  error_message?: string;
}

// Database schema types for Dexie
export interface DatabaseSchema {
  users: User;
  conversations: Conversation;
  messages: Message;
  conversation_participants: ConversationParticipant;
  draft_messages: DraftMessage;
  send_message_requests: SendMessageRequest;
}
