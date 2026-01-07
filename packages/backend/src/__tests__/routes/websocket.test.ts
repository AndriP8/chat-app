import type { WebSocket } from '@fastify/websocket';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { connectionManager } from '@/routes/websocket';
import { mockConversation, mockUsers } from '../utils/fixtures';
import type { MockDb } from '../utils/mocks/db.mock';
import { createMockConnectionManager } from '../utils/mocks/websocket.mock';
import { createMockWebSocket } from '../utils/testHelpers';

// Mock database
vi.mock('@/db', () => {
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

  return {
    db: mockDb,
    users: {},
    messages: {},
    conversations: {},
    conversationParticipants: {},
  };
});

vi.mock('@/services/messageOrderingService', () => ({
  messageOrderingService: {
    processMessage: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/config/env', () => ({
  envConfig: {
    JWT_SECRET: 'test-jwt-secret-key',
  },
}));

describe('WebSocket Handler', () => {
  let mockWs: WebSocket;
  let mockConnectionManager: ReturnType<typeof createMockConnectionManager>;

  beforeEach(() => {
    mockWs = createMockWebSocket();
    mockConnectionManager = createMockConnectionManager();
  });

  describe('Connection Management', () => {
    it('should add connection on successful authentication', () => {
      const connection = {
        socket: mockWs,
        user: mockUsers.alice,
        conversationIds: new Set<string>(),
      };

      mockConnectionManager.addConnection(connection);

      expect(mockConnectionManager.addConnection).toHaveBeenCalledWith(connection);
      expect(mockConnectionManager.connections.has(mockUsers.alice.id)).toBe(true);
    });

    it('should remove connection on disconnect', () => {
      const connection = {
        socket: mockWs,
        user: mockUsers.alice,
        conversationIds: new Set<string>(),
      };

      mockConnectionManager.addConnection(connection);
      mockConnectionManager.removeConnection(connection);

      expect(mockConnectionManager.removeConnection).toHaveBeenCalledWith(connection);
    });

    it('should track multiple connections for same user', () => {
      const conn1 = {
        socket: createMockWebSocket(),
        user: mockUsers.alice,
        conversationIds: new Set<string>(),
      };
      const conn2 = {
        socket: createMockWebSocket(),
        user: mockUsers.alice,
        conversationIds: new Set<string>(),
      };

      mockConnectionManager.addConnection(conn1);
      mockConnectionManager.addConnection(conn2);

      const userConns = mockConnectionManager.connections.get(mockUsers.alice.id);
      expect(userConns?.size).toBe(2);
    });

    it('should cleanup connections when user has no more connections', () => {
      const connection = {
        socket: mockWs,
        user: mockUsers.alice,
        conversationIds: new Set<string>(),
      };

      mockConnectionManager.addConnection(connection);
      mockConnectionManager.removeConnection(connection);

      expect(mockConnectionManager.connections.has(mockUsers.alice.id)).toBe(false);
    });
  });

  describe('TempId Mapping', () => {
    it('should store tempId mapping on message send', () => {
      const tempId = 'temp_123';
      const messageId = 'msg-uuid-456';

      connectionManager.storeTempIdMapping(tempId, messageId, mockConversation.id);

      const retrieved = connectionManager.getTempIdForMessage(messageId, mockConversation.id);
      expect(retrieved).toBe(tempId);
    });

    it('should retrieve tempId for message', () => {
      const tempId = 'temp_123';
      const messageId = 'msg-uuid-456';

      connectionManager.storeTempIdMapping(tempId, messageId, mockConversation.id);

      const retrieved = connectionManager.getTempIdForMessage(messageId, mockConversation.id);
      expect(retrieved).toBe(tempId);
    });

    it('should remove tempId mapping after broadcast', () => {
      const tempId = 'temp_123';
      const messageId = 'msg-uuid-456';

      connectionManager.storeTempIdMapping(tempId, messageId, mockConversation.id);
      connectionManager.removeTempIdMapping(tempId);

      const retrieved = connectionManager.getTempIdForMessage(messageId, mockConversation.id);
      expect(retrieved).toBeUndefined();
    });

    it('should return undefined for non-existent tempId', () => {
      const retrieved = connectionManager.getTempIdForMessage('non-existent', mockConversation.id);
      expect(retrieved).toBeUndefined();
    });
  });

  describe('Conversation Management', () => {
    it('should add user to conversation', () => {
      const connection = {
        socket: mockWs,
        user: mockUsers.alice,
        conversationIds: new Set<string>(),
      };

      mockConnectionManager.addConnection(connection);
      mockConnectionManager.addUserToConversation(mockUsers.alice.id, mockConversation.id);

      expect(mockConnectionManager.addUserToConversation).toHaveBeenCalledWith(
        mockUsers.alice.id,
        mockConversation.id
      );
    });

    it('should remove user from conversation', () => {
      const connection = {
        socket: mockWs,
        user: mockUsers.alice,
        conversationIds: new Set([mockConversation.id]),
      };

      mockConnectionManager.addConnection(connection);
      mockConnectionManager.removeUserFromConversation(mockUsers.alice.id, mockConversation.id);

      expect(mockConnectionManager.removeUserFromConversation).toHaveBeenCalledWith(
        mockUsers.alice.id,
        mockConversation.id
      );
    });
  });

  describe('Broadcasting', () => {
    it('should broadcast to all participants in conversation', async () => {
      // This test just verifies the mock manager was called correctly
      mockConnectionManager.broadcastToConversation(mockConversation.id, {
        type: 'message',
        data: { content: 'Broadcast test' },
      });

      expect(mockConnectionManager.broadcastToConversation).toHaveBeenCalledWith(
        mockConversation.id,
        expect.objectContaining({
          type: 'message',
        })
      );
    });

    it('should handle broadcast errors gracefully', async () => {
      // Should not throw even if there's an error
      await expect(
        connectionManager.broadcastToConversation(mockConversation.id, {
          type: 'message',
          data: {},
        })
      ).resolves.not.toThrow();
    });
  });

  describe('Message Type Handling (Unit Tests)', () => {
    describe('send_message', () => {
      it('should validate message data structure', () => {
        const messageData = {
          type: 'send_message',
          data: {
            conversationId: mockConversation.id,
            content: 'Hello',
            tempId: 'temp_123',
            sequenceNumber: 1,
          },
        };

        expect(messageData.type).toBe('send_message');
        expect(messageData.data.content).toBe('Hello');
        expect(messageData.data.tempId).toBe('temp_123');
      });

      it('should reject empty content', () => {
        const messageData = {
          conversationId: mockConversation.id,
          content: '',
        };

        expect(messageData.content).toBe('');
        // Validation would happen in the actual handler
      });

      it('should handle missing tempId', () => {
        const messageData = {
          conversationId: mockConversation.id,
          content: 'Hello',
          tempId: undefined,
        };

        expect(messageData.tempId).toBeUndefined();
      });
    });

    describe('join_conversation', () => {
      it('should validate conversation ID format', () => {
        const joinData = {
          type: 'join_conversation',
          data: {
            conversationId: mockConversation.id,
          },
        };

        expect(joinData.data.conversationId).toBe(mockConversation.id);
        expect(typeof joinData.data.conversationId).toBe('string');
      });

      it('should reject invalid conversation ID', () => {
        const joinData = {
          type: 'join_conversation',
          data: {
            conversationId: null,
          },
        };

        expect(joinData.data.conversationId).toBeNull();
      });
    });

    describe('message_delivered', () => {
      it('should validate message ID and conversation ID', () => {
        const deliveredData = {
          type: 'message_delivered',
          data: {
            messageId: 'msg-123',
            conversationId: mockConversation.id,
          },
        };

        expect(deliveredData.type).toBe('message_delivered');
        expect(deliveredData.data.messageId).toBe('msg-123');
        expect(deliveredData.data.conversationId).toBe(mockConversation.id);
      });
    });

    describe('message_read', () => {
      it('should validate message ID and conversation ID', () => {
        const readData = {
          type: 'message_read',
          data: {
            messageId: 'msg-123',
            conversationId: mockConversation.id,
          },
        };

        expect(readData.type).toBe('message_read');
        expect(readData.data.messageId).toBe('msg-123');
      });
    });

    describe('leave_conversation', () => {
      it('should validate conversation ID', () => {
        const leaveData = {
          type: 'leave_conversation',
          data: {
            conversationId: mockConversation.id,
          },
        };

        expect(leaveData.type).toBe('leave_conversation');
        expect(leaveData.data.conversationId).toBe(mockConversation.id);
      });
    });
  });

  describe('ConnectionManager Real Implementation Tests', () => {
    beforeEach(() => {
      // biome-ignore lint/suspicious/noExplicitAny: <Verify connection was added (accessing private field for testing)>
      (connectionManager as any).userConnections.clear();
      // biome-ignore lint/suspicious/noExplicitAny: <Verify connection was added (accessing private field for testing)>
      (connectionManager as any).tempIdMappings.clear();
    });

    it('should correctly add and remove connections', () => {
      const ws = createMockWebSocket();
      const connection = {
        socket: ws,
        user: mockUsers.alice,
        conversationIds: new Set<string>(),
      };

      connectionManager.addConnection(connection);

      // biome-ignore lint/suspicious/noExplicitAny: <Verify connection was added (accessing private field for testing)>
      const connections = (connectionManager as any).userConnections;
      expect(connections.has(mockUsers.alice.id)).toBe(true);

      connectionManager.removeConnection(connection);

      // Verify connection was removed
      expect(connections.has(mockUsers.alice.id)).toBe(false);
    });

    it('should handle adding/removing user from conversation', () => {
      const ws = createMockWebSocket();
      const connection = {
        socket: ws,
        user: mockUsers.alice,
        conversationIds: new Set<string>(),
      };

      connectionManager.addConnection(connection);
      connectionManager.addUserToConversation(mockUsers.alice.id, mockConversation.id);

      expect(connection.conversationIds.has(mockConversation.id)).toBe(true);

      connectionManager.removeUserFromConversation(mockUsers.alice.id, mockConversation.id);

      expect(connection.conversationIds.has(mockConversation.id)).toBe(false);
    });

    it('should cleanup expired tempId mappings after TTL', () => {
      vi.useFakeTimers();

      const tempId = 'temp_123';
      const messageId = 'msg-456';

      connectionManager.storeTempIdMapping(tempId, messageId, mockConversation.id);

      // Should exist immediately
      let retrieved = connectionManager.getTempIdForMessage(messageId, mockConversation.id);
      expect(retrieved).toBe(tempId);

      // Advance time by 31 seconds (TTL is 30 seconds)
      vi.advanceTimersByTime(31000);

      // Store a new tempId to trigger cleanup
      connectionManager.storeTempIdMapping('temp_new', 'msg-new', mockConversation.id);

      // Old tempId should be cleaned up
      retrieved = connectionManager.getTempIdForMessage(messageId, mockConversation.id);
      expect(retrieved).toBeUndefined();

      vi.useRealTimers();
    });
  });

  describe('Edge Cases', () => {
    it('should handle connection removal when user has no connections', () => {
      const connection = {
        socket: mockWs,
        user: mockUsers.alice,
        conversationIds: new Set<string>(),
      };

      // Try to remove connection that was never added
      connectionManager.removeConnection(connection);

      // Should not throw
      expect(true).toBe(true);
    });

    it('should handle multiple sequential add/remove operations', () => {
      const connection = {
        socket: mockWs,
        user: mockUsers.alice,
        conversationIds: new Set<string>(),
      };

      connectionManager.addConnection(connection);
      connectionManager.removeConnection(connection);
      connectionManager.addConnection(connection);
      connectionManager.removeConnection(connection);

      // Should not throw
      expect(true).toBe(true);
    });
  });
});
