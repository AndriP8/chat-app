export interface User {
  id: string;
  email: string;
  passwordHash?: string;
  name: string;
  profilePictureUrl?: string;
  isDemo?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Conversation {
  id: string;
  name?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  content: string;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  createdAt: Date;
  updatedAt: Date;
  senderId: string;
  conversationId: string;
  tempId?: string;
  sequenceNumber?: number;
}

export interface ConversationParticipant {
  conversationId: string;
  userId: string;
}

// Client-side only entities (not synced to server)
export interface DraftMessage {
  id: string;
  conversationId: string;
  userId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SendMessageRequest {
  id: string;
  messageId: string;
  status: 'pending' | 'in_flight' | 'failed';
  lastSentAt?: Date;
  retryCount: number;
  errorMessage?: string;
  createdAt: Date;
}

export interface SequenceCounter {
  conversationId: string;
  userId: string;
  nextSequence: number;
  updatedAt: Date;
}

export interface PaginationMetadata {
  conversationId: string;
  hasMore: boolean;
  nextCursor: string | null;
  lastMessageId: string | null;
  updatedAt: Date;
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
