import type { Conversation, Message, User } from '@/db/schema';

export const mockUsers = {
  alice: {
    id: 'alice-uuid-1234',
    email: 'alice@test.com',
    name: 'Alice Chen',
    password_hash: '$2a$04$hashed_password', // bcrypt hash for 'password123'
    profile_picture_url: null,
    is_demo: false,
    created_at: new Date('2024-01-01T00:00:00Z'),
    updated_at: new Date('2024-01-01T00:00:00Z'),
  } as User,

  bob: {
    id: 'bob-uuid-5678',
    email: 'bob@test.com',
    name: 'Bob Smith',
    password_hash: '$2a$04$hashed_password',
    profile_picture_url: null,
    is_demo: false,
    created_at: new Date('2024-01-01T00:00:00Z'),
    updated_at: new Date('2024-01-01T00:00:00Z'),
  } as User,

  demo: {
    id: 'demo-uuid-9999',
    email: 'demo@test.com',
    name: 'Demo User',
    password_hash: '$2a$04$hashed_password',
    profile_picture_url: null,
    is_demo: true,
    created_at: new Date('2024-01-01T00:00:00Z'),
    updated_at: new Date('2024-01-01T00:00:00Z'),
  } as User,
};

export const mockConversation: Conversation = {
  id: 'conv-uuid-1111',
  name: null,
  created_by: mockUsers.alice.id,
  created_at: new Date('2024-01-01T00:00:00Z'),
  updated_at: new Date('2024-01-01T00:00:00Z'),
};

export const createMockMessage = (overrides?: Partial<Message>): Message => ({
  id: `msg-uuid-${Math.random().toString(36).substring(7)}`,
  content: 'Test message',
  status: 'sent',
  sender_id: mockUsers.alice.id,
  conversation_id: mockConversation.id,
  sequence_number: 1,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

export const mockMessages = {
  seq1: createMockMessage({ id: 'msg-1', sequence_number: 1, content: 'First message' }),
  seq2: createMockMessage({ id: 'msg-2', sequence_number: 2, content: 'Second message' }),
  seq3: createMockMessage({ id: 'msg-3', sequence_number: 3, content: 'Third message' }),
};
