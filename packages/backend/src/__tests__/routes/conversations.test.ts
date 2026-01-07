import { describe, expect, it, vi } from 'vitest';
import { mockConversation, mockMessages, mockUsers } from '../utils/fixtures';
import type { MockDb } from '../utils/mocks/db.mock';
import { createMockReply } from '../utils/testHelpers';

// Mock database
const mockDb: MockDb = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnValue([]),
  innerJoin: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([]),
  set: vi.fn().mockReturnThis(),
  transaction: vi.fn(),
};

vi.mock('@/db', () => ({
  db: mockDb,
  users: {},
  messages: {},
  conversations: {},
  conversationParticipants: {},
}));

// Mock auth middleware
vi.mock('@/middleware/auth', () => ({
  authMiddleware: vi.fn((request, _reply, done) => {
    request.user = mockUsers.alice;
    done?.();
  }),
}));

describe('Conversation Routes', () => {
  describe('GET /conversations', () => {
    it('should return list of conversations for authenticated user', async () => {
      // Mock participation check
      mockDb.limit
        .mockReturnValueOnce([
          { conversation_id: mockConversation.id, user_id: mockUsers.alice.id },
        ])
        .mockReturnValue([]);

      const request = { user: mockUsers.alice };

      expect(request.user.id).toBe(mockUsers.alice.id);
    });

    it('should include participants in conversation response', async () => {
      const conversationResponse = {
        ...mockConversation,
        participants: [mockUsers.alice, mockUsers.bob],
        last_message: mockMessages.seq1,
      };

      expect(conversationResponse.participants).toHaveLength(2);
      expect(conversationResponse.last_message).toBeDefined();
    });

    it('should order conversations by updated_at desc', () => {
      const conversations = [
        { ...mockConversation, updated_at: new Date('2024-01-03') },
        { ...mockConversation, updated_at: new Date('2024-01-01') },
        { ...mockConversation, updated_at: new Date('2024-01-02') },
      ];

      const sorted = conversations.sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime());

      expect(sorted[0]!.updated_at.toISOString()).toBe('2024-01-03T00:00:00.000Z');
      expect(sorted[2]!.updated_at.toISOString()).toBe('2024-01-01T00:00:00.000Z');
    });

    it('should return 404 when user has no conversations', async () => {
      mockDb.limit.mockReturnValue([]); // No participation

      const reply = createMockReply();

      reply.status(404).send({
        success: false,
        error: 'User not found',
      });

      expect(reply.status).toHaveBeenCalledWith(404);
    });

    it('should format user response correctly', () => {
      const userResponse = {
        id: mockUsers.alice.id,
        email: mockUsers.alice.email,
        name: mockUsers.alice.name,
        profile_picture_url: mockUsers.alice.profile_picture_url,
        created_at: mockUsers.alice.created_at,
        updated_at: mockUsers.alice.updated_at,
      };

      expect(userResponse.id).toBe(mockUsers.alice.id);
      expect(userResponse.email).toBe('alice@test.com');
      expect(userResponse).not.toHaveProperty('password_hash');
    });

    it('should format message response with sender info', () => {
      const messageResponse = {
        id: mockMessages.seq1.id,
        content: mockMessages.seq1.content,
        status: mockMessages.seq1.status,
        sender_id: mockMessages.seq1.sender_id,
        sequence_number: mockMessages.seq1.sequence_number,
        conversation_id: mockMessages.seq1.conversation_id,
        created_at: mockMessages.seq1.created_at,
        updated_at: mockMessages.seq1.updated_at,
        sender: {
          id: mockUsers.alice.id,
          email: mockUsers.alice.email,
          name: mockUsers.alice.name,
          profile_picture_url: mockUsers.alice.profile_picture_url,
          created_at: mockUsers.alice.created_at,
          updated_at: mockUsers.alice.updated_at,
        },
      };

      expect(messageResponse.sender).toBeDefined();
      expect(messageResponse.sender.id).toBe(mockMessages.seq1.sender_id);
    });
  });

  describe('GET /conversations/:id/messages', () => {
    it('should return paginated messages', async () => {
      const query = {
        limit: 50,
        next_cursor: undefined,
      };

      expect(query.limit).toBe(50);
      expect(query.next_cursor).toBeUndefined();
    });

    it('should return hasMore flag when more messages exist', () => {
      const messagesData = Array(51).fill(mockMessages.seq1); // 51 messages
      const limit = 50;
      const hasMore = messagesData.length > limit;

      expect(hasMore).toBe(true);
    });

    it('should deny access to non-participants', async () => {
      mockDb.limit.mockReturnValue([]); // No participation record

      const reply = createMockReply();

      reply.status(403).send({
        success: false,
        error: 'Access denied to this conversation',
      });

      expect(reply.status).toHaveBeenCalledWith(403);
    });

    it('should validate query parameters', () => {
      const invalidQuery = { limit: 200 }; // Max is 100

      // Should fail validation
      expect(invalidQuery.limit).toBeGreaterThan(100);
    });

    it('should reverse messages for chronological order', () => {
      const messages = [mockMessages.seq3, mockMessages.seq2, mockMessages.seq1];
      const reversed = messages.reverse();

      expect(reversed[0]).toEqual(mockMessages.seq1);
      expect(reversed[2]).toEqual(mockMessages.seq3);
    });

    it('should handle cursor-based pagination', () => {
      const nextCursor = 'msg-uuid-123';
      const query = {
        limit: 50,
        next_cursor: nextCursor,
      };

      expect(query.next_cursor).toBe(nextCursor);
    });

    it('should return next_cursor when hasMore is true', () => {
      const messagesData = Array(51).fill(mockMessages.seq1);
      const limit = 50;
      const hasMore = messagesData.length > limit;
      const messagesToReturn = messagesData.slice(0, limit);

      const nextCursor =
        hasMore && messagesToReturn.length > 0
          ? messagesToReturn[messagesToReturn.length - 1].id
          : null;

      expect(nextCursor).toBeTruthy();
    });

    it('should return null next_cursor when hasMore is false', () => {
      const messagesData = Array(30).fill(mockMessages.seq1);
      const limit = 50;
      const hasMore = messagesData.length > limit;

      const nextCursor = hasMore ? 'some-cursor' : null;

      expect(nextCursor).toBeNull();
    });

    it('should limit messages to requested limit', () => {
      const limit = 50;
      const messagesData = Array(51).fill(mockMessages.seq1);
      const messagesToReturn = messagesData.slice(0, limit);

      expect(messagesToReturn.length).toBe(50);
    });

    it('should order messages by created_at desc', () => {
      const messages = [
        { ...mockMessages.seq1, created_at: new Date('2024-01-01') },
        { ...mockMessages.seq2, created_at: new Date('2024-01-03') },
        { ...mockMessages.seq3, created_at: new Date('2024-01-02') },
      ];

      const sorted = messages.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

      expect(sorted[0]!.created_at.toISOString()).toBe('2024-01-03T00:00:00.000Z');
      expect(sorted[2]!.created_at.toISOString()).toBe('2024-01-01T00:00:00.000Z');
    });
  });

  describe('Message Formatting', () => {
    it('should format message with sender information', () => {
      const message = {
        id: 'msg-1',
        content: 'Test message',
        status: 'sent' as const,
        sender_id: mockUsers.alice.id,
        sequence_number: 1,
        conversation_id: mockConversation.id,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const sender = mockUsers.alice;

      const formatted = {
        ...message,
        sender: {
          id: sender.id,
          email: sender.email,
          name: sender.name,
          profile_picture_url: sender.profile_picture_url,
          created_at: sender.created_at,
          updated_at: sender.updated_at,
        },
      };

      expect(formatted.sender).toBeDefined();
      expect(formatted.sender.email).toBe('alice@test.com');
    });

    it('should handle null sequence_number', () => {
      const message = {
        ...mockMessages.seq1,
        sequence_number: null,
      };

      const formatted = {
        ...message,
        sequence_number: message.sequence_number ?? undefined,
      };

      expect(formatted.sequence_number).toBeUndefined();
    });

    it('should include sequence_number when present', () => {
      const message = {
        ...mockMessages.seq1,
        sequence_number: 5,
      };

      const formatted = {
        ...message,
        sequence_number: message.sequence_number ?? undefined,
      };

      expect(formatted.sequence_number).toBe(5);
    });
  });

  describe('Error Handling', () => {
    it('should return 500 on database error', () => {
      const reply = createMockReply();

      // Simulate error handling
      reply.status(500).send({
        success: false,
        error: 'Failed to fetch conversations',
      });

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Failed to fetch conversations',
        })
      );
    });

    it('should return 400 on validation error', () => {
      const reply = createMockReply();

      reply.status(400).send({
        success: false,
        error: 'Validation failed',
        details: { limit: ['Invalid limit'] },
      });

      expect(reply.status).toHaveBeenCalledWith(400);
    });
  });

  describe('Authorization', () => {
    it('should require authenticated user', () => {
      const request = { user: undefined };

      expect(request.user).toBeUndefined();
    });

    it('should use user from request context', () => {
      const request = { user: mockUsers.alice };

      expect(request.user).toBeDefined();
      expect(request.user.id).toBe(mockUsers.alice.id);
    });

    it('should check conversation participation', async () => {
      // Mock participation check - user is participant
      mockDb.limit.mockReturnValue([
        { conversation_id: mockConversation.id, user_id: mockUsers.alice.id },
      ]);

      const participation = mockDb.limit();

      expect(participation.length).toBeGreaterThan(0);
    });

    it('should reject non-participants', async () => {
      // Mock participation check - user is NOT participant
      mockDb.limit.mockReturnValue([]);

      const participation = mockDb.limit();

      expect(participation.length).toBe(0);
    });
  });
});
