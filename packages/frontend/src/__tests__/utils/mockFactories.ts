import type {
  Conversation,
  DraftMessage,
  Message,
  SendMessageRequest,
  User,
} from '@/types/database';

let messageIdCounter = 0;
let conversationIdCounter = 0;
let userIdCounter = 0;

/**
 * Reset all ID counters - call this in beforeEach() to ensure consistent IDs across tests
 */
export function resetMockCounters(): void {
  messageIdCounter = 0;
  conversationIdCounter = 0;
  userIdCounter = 0;
}

/**
 * Generate a mock user
 */
export function createMockUser(overrides?: Partial<User>): User {
  const id = overrides?.id || `user-${++userIdCounter}`;
  return {
    id,
    name: `Test User ${userIdCounter}`,
    email: `user${userIdCounter}@test.com`,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

/**
 * Generate a mock conversation
 */
export function createMockConversation(overrides?: Partial<Conversation>): Conversation {
  const id = overrides?.id || `conv-${++conversationIdCounter}`;
  return {
    id,
    created_by: 'user-1',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

/**
 * Generate a mock message
 */
export function createMockMessage(overrides?: Partial<Message>): Message {
  const id = overrides?.id || `msg-${++messageIdCounter}`;
  const conversation_id = overrides?.conversation_id || 'conv-1';
  const sender_id = overrides?.sender_id || 'user-1';

  return {
    id,
    conversation_id,
    sender_id,
    content: `Test message ${messageIdCounter}`,
    status: 'sent',
    created_at: new Date(),
    updated_at: new Date(),
    sequence_number: overrides?.sequence_number ?? messageIdCounter,
    ...overrides,
  };
}

/**
 * Generate a mock draft message
 */
export function createMockDraft(overrides?: Partial<DraftMessage>): DraftMessage {
  return {
    id: `draft-${Date.now()}-${Math.random()}`,
    conversation_id: overrides?.conversation_id || 'conv-1',
    user_id: overrides?.user_id || 'user-1',
    content: overrides?.content || 'Draft message content',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

/**
 * Generate a mock send message request
 */
export function createMockSendRequest(overrides?: Partial<SendMessageRequest>): SendMessageRequest {
  return {
    id: `req-${Date.now()}-${Math.random()}`,
    message_id: overrides?.message_id || 'msg-1',
    status: 'pending',
    retry_count: 0,
    created_at: new Date(),
    last_sent_at: undefined,
    ...overrides,
  };
}
