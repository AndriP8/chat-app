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
    createdAt: new Date(),
    updatedAt: new Date(),
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
    createdBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Generate a mock message
 */
export function createMockMessage(overrides?: Partial<Message>): Message {
  const id = overrides?.id || `msg-${++messageIdCounter}`;
  const conversationId = overrides?.conversationId || 'conv-1';
  const senderId = overrides?.senderId || 'user-1';

  return {
    id,
    conversationId,
    senderId,
    content: `Test message ${messageIdCounter}`,
    status: 'sent',
    createdAt: new Date(),
    updatedAt: new Date(),
    sequenceNumber: overrides?.sequenceNumber ?? messageIdCounter,
    ...overrides,
  };
}

/**
 * Generate a mock draft message
 */
export function createMockDraft(overrides?: Partial<DraftMessage>): DraftMessage {
  return {
    id: `draft-${Date.now()}-${Math.random()}`,
    conversationId: overrides?.conversationId || 'conv-1',
    userId: overrides?.userId || 'user-1',
    content: overrides?.content || 'Draft message content',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Generate a mock send message request
 */
export function createMockSendRequest(overrides?: Partial<SendMessageRequest>): SendMessageRequest {
  return {
    id: `req-${Date.now()}-${Math.random()}`,
    messageId: overrides?.messageId || 'msg-1',
    status: 'pending',
    retryCount: 0,
    createdAt: new Date(),
    lastSentAt: undefined,
    ...overrides,
  };
}
