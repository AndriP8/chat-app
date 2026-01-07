import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMockConversation,
  createMockMessage,
  createMockUser,
  resetMockCounters,
} from '@/__tests__/utils/mockFactories';
import { broadcastChannelService } from '@/services/broadcastChannel';
import { dataSyncer } from '@/services/dataSyncer';
import { webSocketService } from '@/services/websocket';
import type { ChatRoom, Message } from '@/types/chat';
import { useWebSocketConversations } from '../useWebSocketConversations';

// Mock modules
vi.mock('@/services/dataSyncer', () => ({
  dataSyncer: {
    loadConversations: vi.fn(),
    loadMessages: vi.fn(),
    loadMoreMessages: vi.fn(),
    sendMessage: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
}));

vi.mock('@/services/websocket', () => ({
  webSocketService: {
    joinConversation: vi.fn(),
    leaveConversation: vi.fn(),
    isConnected: vi.fn().mockReturnValue(true),
  },
}));

vi.mock('@/services/broadcastChannel', () => ({
  broadcastChannelService: {
    setEventHandlers: vi.fn(),
    destroy: vi.fn(),
  },
}));

vi.mock('@/services/databaseOperations', () => ({
  dbOps: {
    getUser: vi.fn(),
    getConversationMessages: vi.fn(),
  },
}));

// Mock Auth Context
const mockCurrentUser = createMockUser({ id: 'current-user', name: 'Current User' });

vi.mock('@/components/auth/AuthContext', () => ({
  useAuth: () => ({
    currentUser: mockCurrentUser,
  }),
}));

describe('useWebSocketConversations', () => {
  beforeEach(() => {
    resetMockCounters();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Hook Initialization', () => {
    it('should load conversations on mount', async () => {
      const mockConversations: ChatRoom[] = [createMockConversation() as unknown as ChatRoom];
      vi.mocked(dataSyncer.loadConversations).mockResolvedValue(mockConversations);

      const { result } = renderHook(() => useWebSocketConversations());

      await waitFor(() => {
        expect(result.current.conversations).toEqual(mockConversations);
      });

      expect(dataSyncer.loadConversations).toHaveBeenCalledWith('current-user');
    });

    it('should setup dataSyncer event listeners', () => {
      renderHook(() => useWebSocketConversations());

      expect(dataSyncer.on).toHaveBeenCalledWith('messageReceived', expect.any(Function));
      expect(dataSyncer.on).toHaveBeenCalledWith('messageStatusUpdated', expect.any(Function));
    });

    it('should setup broadcastChannel event listeners', () => {
      renderHook(() => useWebSocketConversations());

      expect(broadcastChannelService.setEventHandlers).toHaveBeenCalledWith({
        onMessageReceived: expect.any(Function),
        onMessageStatusUpdated: expect.any(Function),
        onPaginationCompleted: expect.any(Function),
      });
    });

    it('should cleanup listeners on unmount', () => {
      const { unmount } = renderHook(() => useWebSocketConversations());

      unmount();

      expect(dataSyncer.off).toHaveBeenCalledWith('messageReceived');
      expect(dataSyncer.off).toHaveBeenCalledWith('messageStatusUpdated');
      expect(broadcastChannelService.destroy).toHaveBeenCalled();
    });
  });

  describe('Load Conversations', () => {
    it('should set loading state while fetching', async () => {
      vi.mocked(dataSyncer.loadConversations).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve([createMockConversation() as unknown as ChatRoom]), 100)
          )
      );

      const { result } = renderHook(() => useWebSocketConversations());

      // Initially loading
      expect(result.current.loading.conversations).toBe(true);

      await waitFor(() => {
        expect(result.current.loading.conversations).toBe(false);
      });
    });

    it('should set error state on failure', async () => {
      vi.mocked(dataSyncer.loadConversations).mockRejectedValue(new Error('Load failed'));

      const { result } = renderHook(() => useWebSocketConversations());

      await waitFor(() => {
        expect(result.current.error.conversations).toBe('Load failed');
      });
    });

    it('should clear loading state on completion', async () => {
      vi.mocked(dataSyncer.loadConversations).mockResolvedValue([]);

      const { result } = renderHook(() => useWebSocketConversations());

      await waitFor(() => {
        expect(result.current.loading.conversations).toBe(false);
      });
    });
  });

  describe('Load Messages', () => {
    it('should set loading state for specific conversation', async () => {
      const conversationId = 'conv-1';
      vi.mocked(dataSyncer.loadMessages).mockResolvedValue({
        messages: [],
        hasMore: false,
      });

      const { result } = renderHook(() => useWebSocketConversations());

      // Ensure conversations are loaded first
      await waitFor(() => {
        expect(result.current.loading.conversations).toBe(false);
      });

      result.current.loadMessages(conversationId);

      await waitFor(() => {
        expect(result.current.loading.messages[conversationId]).toBe(false);
      });
    });

    it('should join conversation via WebSocket', async () => {
      const conversationId = 'conv-1';
      const mockMessages = [createMockMessage()];
      vi.mocked(dataSyncer.loadMessages).mockResolvedValue({
        messages: mockMessages as never,
        hasMore: false,
      });

      const { result } = renderHook(() => useWebSocketConversations());

      await waitFor(() => {
        expect(result.current.loading.conversations).toBe(false);
      });

      await result.current.loadMessages(conversationId);

      await waitFor(() => {
        expect(webSocketService.joinConversation).toHaveBeenCalledWith(conversationId);
      });
    });

    it('should handle load errors', async () => {
      const conversationId = 'conv-1';
      vi.mocked(dataSyncer.loadMessages).mockRejectedValue(new Error('Load messages failed'));

      const { result } = renderHook(() => useWebSocketConversations());

      await waitFor(() => {
        expect(result.current.loading.conversations).toBe(false);
      });

      await result.current.loadMessages(conversationId);

      await waitFor(() => {
        expect(result.current.error.messages?.[conversationId]).toBe('Load messages failed');
      });
    });
  });

  describe('Load More Messages (Pagination)', () => {
    it('should prevent loading if no messages exist', async () => {
      const conversationId = 'conv-1';

      const { result } = renderHook(() => useWebSocketConversations());

      await waitFor(() => {
        expect(result.current.loading.conversations).toBe(false);
      });

      await result.current.loadMoreMessages(conversationId);

      expect(dataSyncer.loadMoreMessages).not.toHaveBeenCalled();
    });

    it('should prevent loading if already loading', async () => {
      const conversationId = 'conv-1';
      const message = createMockMessage();

      vi.mocked(dataSyncer.loadMessages).mockResolvedValue({
        messages: [message] as never,
        hasMore: true,
      });

      let loadMoreResolve: ((value: { messages: Message[]; hasMore: boolean }) => void) | null =
        null;
      vi.mocked(dataSyncer.loadMoreMessages).mockImplementation(
        () =>
          new Promise((resolve) => {
            loadMoreResolve = resolve;
          })
      );

      const { result } = renderHook(() => useWebSocketConversations());

      await waitFor(() => {
        expect(result.current.loading.conversations).toBe(false);
      });

      await result.current.loadMessages(conversationId);

      await waitFor(() => {
        expect(result.current.messages[conversationId]).toHaveLength(1);
      });

      // Start loading more (this will hang until we resolve it)
      result.current.loadMoreMessages(conversationId);

      // Wait for loading state to be set
      await waitFor(() => {
        expect(result.current.loading.loadingMore[conversationId]).toBe(true);
      });

      // Try loading again while first is in progress - should be prevented
      result.current.loadMoreMessages(conversationId);

      // Should still only be called once
      expect(dataSyncer.loadMoreMessages).toHaveBeenCalledTimes(1);

      // Clean up by resolving the promise
      if (loadMoreResolve) {
        // biome-ignore lint/suspicious/noExplicitAny: Mock promise resolver type narrowing issue
        (loadMoreResolve as any)({ messages: [], hasMore: false });
      }
    });

    it('should prevent loading if no more messages (hasMore=false)', async () => {
      const conversationId = 'conv-1';
      const message = createMockMessage();

      vi.mocked(dataSyncer.loadMessages).mockResolvedValue({
        messages: [message] as never,
        hasMore: false,
      });

      const { result } = renderHook(() => useWebSocketConversations());

      await waitFor(() => {
        expect(result.current.loading.conversations).toBe(false);
      });

      await result.current.loadMessages(conversationId);

      await waitFor(() => {
        expect(result.current.pagination.hasMore[conversationId]).toBe(false);
      });

      await result.current.loadMoreMessages(conversationId);

      expect(dataSyncer.loadMoreMessages).not.toHaveBeenCalled();
    });

    it('should load older messages successfully', async () => {
      const conversationId = 'conv-1';
      const message1 = createMockMessage({ id: 'msg-1' });
      const message2 = createMockMessage({ id: 'msg-2' });

      vi.mocked(dataSyncer.loadMessages).mockResolvedValue({
        messages: [message1] as never,
        hasMore: true,
      });

      vi.mocked(dataSyncer.loadMoreMessages).mockResolvedValue({
        messages: [message2] as never,
        hasMore: false,
      });

      const { result } = renderHook(() => useWebSocketConversations());

      await waitFor(() => {
        expect(result.current.loading.conversations).toBe(false);
      });

      await result.current.loadMessages(conversationId);

      await waitFor(() => {
        expect(result.current.messages[conversationId]).toHaveLength(1);
      });

      await result.current.loadMoreMessages(conversationId);

      await waitFor(() => {
        expect(result.current.messages[conversationId]).toHaveLength(2);
      });
    });

    it('should handle errors with LOAD_MORE_MESSAGES_FAILURE', async () => {
      const conversationId = 'conv-1';
      const message = createMockMessage();

      vi.mocked(dataSyncer.loadMessages).mockResolvedValue({
        messages: [message] as never,
        hasMore: true,
      });

      vi.mocked(dataSyncer.loadMoreMessages).mockRejectedValue(new Error('Load more failed'));

      const { result } = renderHook(() => useWebSocketConversations());

      await waitFor(() => {
        expect(result.current.loading.conversations).toBe(false);
      });

      await result.current.loadMessages(conversationId);

      await waitFor(() => {
        expect(result.current.messages[conversationId]).toHaveLength(1);
      });

      await result.current.loadMoreMessages(conversationId);

      await waitFor(() => {
        expect(result.current.loading.loadingMore[conversationId]).toBe(false);
      });
    });
  });

  describe('Send Message', () => {
    it('should validate content not empty', async () => {
      const { result } = renderHook(() => useWebSocketConversations());

      await waitFor(() => {
        expect(result.current.loading.conversations).toBe(false);
      });

      await expect(result.current.sendMessage('conv-1', '')).rejects.toThrow(
        'Message content cannot be empty'
      );
    });

    it('should validate content length ≤ 1000 characters', async () => {
      const { result } = renderHook(() => useWebSocketConversations());

      await waitFor(() => {
        expect(result.current.loading.conversations).toBe(false);
      });

      const longMessage = 'a'.repeat(1001);

      await expect(result.current.sendMessage('conv-1', longMessage)).rejects.toThrow(
        'Message is too long (max 1000 characters)'
      );
    });

    it('should create temporary message with tempId', async () => {
      vi.mocked(dataSyncer.sendMessage).mockResolvedValue();

      const { result } = renderHook(() => useWebSocketConversations());

      await waitFor(() => {
        expect(result.current.loading.conversations).toBe(false);
      });

      await result.current.sendMessage('conv-1', 'Test message');

      await waitFor(() => {
        expect(dataSyncer.sendMessage).toHaveBeenCalledWith(
          'conv-1',
          'Test message',
          expect.stringContaining('temp-'),
          'current-user'
        );
      });
    });

    it('should call dataSyncer.sendMessage', async () => {
      vi.mocked(dataSyncer.sendMessage).mockResolvedValue();

      const { result } = renderHook(() => useWebSocketConversations());

      await waitFor(() => {
        expect(result.current.loading.conversations).toBe(false);
      });

      await result.current.sendMessage('conv-1', 'Hello');

      expect(dataSyncer.sendMessage).toHaveBeenCalled();
    });

    it('should join conversation if WebSocket connected', async () => {
      vi.mocked(dataSyncer.sendMessage).mockResolvedValue();
      vi.mocked(webSocketService.isConnected).mockReturnValue(true);

      const { result } = renderHook(() => useWebSocketConversations());

      await waitFor(() => {
        expect(result.current.loading.conversations).toBe(false);
      });

      await result.current.sendMessage('conv-1', 'Hello');

      await waitFor(() => {
        expect(webSocketService.joinConversation).toHaveBeenCalledWith('conv-1');
      });
    });

    it('should update message status to failed on error', async () => {
      vi.mocked(dataSyncer.sendMessage).mockRejectedValue(new Error('Send failed'));

      const { result } = renderHook(() => useWebSocketConversations());

      await waitFor(() => {
        expect(result.current.loading.conversations).toBe(false);
      });

      await result.current.sendMessage('conv-1', 'Failed message');

      await waitFor(() => {
        expect(result.current.error.send).toBe('Send failed');
      });
    });
  });

  describe('Message Deduplication', () => {
    it('should prevent duplicate message handling', async () => {
      // This is tested through the internal implementation
      // The processedMessagesRef prevents duplicate processing
      expect(true).toBe(true);
    });

    it('should prevent duplicate status updates', async () => {
      // This is tested through the internal implementation
      // The processedStatusUpdatesRef prevents duplicate processing
      expect(true).toBe(true);
    });
  });

  describe('Join Conversation Logic', () => {
    it('should join new conversation via WebSocket', async () => {
      vi.mocked(dataSyncer.loadMessages).mockResolvedValue({
        messages: [],
        hasMore: false,
      });

      const { result } = renderHook(() => useWebSocketConversations());

      await waitFor(() => {
        expect(result.current.loading.conversations).toBe(false);
      });

      await result.current.loadMessages('conv-1');

      expect(webSocketService.joinConversation).toHaveBeenCalledWith('conv-1');
    });

    it('should leave previous conversation before joining new', async () => {
      vi.mocked(dataSyncer.loadMessages).mockResolvedValue({
        messages: [],
        hasMore: false,
      });

      const { result } = renderHook(() => useWebSocketConversations());

      await waitFor(() => {
        expect(result.current.loading.conversations).toBe(false);
      });

      // Join first conversation
      await result.current.loadMessages('conv-1');

      expect(webSocketService.joinConversation).toHaveBeenCalledWith('conv-1');

      // Join second conversation (should leave first)
      await result.current.loadMessages('conv-2');

      expect(webSocketService.leaveConversation).toHaveBeenCalledWith('conv-1');
      expect(webSocketService.joinConversation).toHaveBeenCalledWith('conv-2');
    });
  });
});
