import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockMessage } from '@/__tests__/utils/mockFactories';
import type { Message } from '@/types/database';
import { BroadcastChannelService } from '../broadcastChannel';

describe('BroadcastChannelService', () => {
  let service: BroadcastChannelService;

  beforeEach(() => {
    service = new BroadcastChannelService();
  });

  afterEach(() => {
    service.destroy();
  });

  describe('Initialization', () => {
    it('should initialize with unique tab ID', () => {
      const service1 = new BroadcastChannelService();
      const service2 = new BroadcastChannelService();

      // Access tabId via type assertion for testing
      // biome-ignore lint/suspicious/noExplicitAny: Testing private property
      const tabId1 = (service1 as any).tabId;
      // biome-ignore lint/suspicious/noExplicitAny: Testing private property
      const tabId2 = (service2 as any).tabId;

      expect(tabId1).toBeDefined();
      expect(tabId2).toBeDefined();
      expect(tabId1).not.toBe(tabId2);
      expect(tabId1).toMatch(/^tab_\d+_[a-z0-9]+$/);

      service1.destroy();
      service2.destroy();
    });

    it('should detect BroadcastChannel support', () => {
      expect(typeof BroadcastChannel).toBe('function');

      const service = new BroadcastChannelService();
      // biome-ignore lint/suspicious/noExplicitAny: Testing private property
      const isSupported = (service as any).isSupported;

      expect(isSupported).toBe(true);

      service.destroy();
    });

    it('should handle missing BroadcastChannel gracefully', () => {
      // Temporarily remove BroadcastChannel
      const originalBC = globalThis.BroadcastChannel;
      // @ts-expect-error - Testing unsupported environment
      delete globalThis.BroadcastChannel;

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const service = new BroadcastChannelService();
      // biome-ignore lint/suspicious/noExplicitAny: Testing private property
      const isSupported = (service as any).isSupported;

      expect(isSupported).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('BroadcastChannel not supported')
      );

      service.destroy();
      consoleWarnSpy.mockRestore();

      // Restore BroadcastChannel
      globalThis.BroadcastChannel = originalBC;
    });
  });

  describe('Cross-Tab Communication', () => {
    it('should broadcast message received event to other tabs', (done: () => void) => {
      const service1 = new BroadcastChannelService();
      const service2 = new BroadcastChannelService();

      const mockMessage = createMockMessage({ content: 'Hello from tab 1' });

      service2.setEventHandlers({
        onMessageReceived: (message) => {
          expect(message.id).toBe(mockMessage.id);
          expect(message.content).toBe('Hello from tab 1');
          service1.destroy();
          service2.destroy();
          done();
        },
      });

      service1.broadcastMessageReceived(mockMessage);
    });

    it('should not receive own messages (prevent echo)', () => {
      const service1 = new BroadcastChannelService();
      const onMessageReceived = vi.fn();

      service1.setEventHandlers({ onMessageReceived });

      const mockMessage = createMockMessage();
      service1.broadcastMessageReceived(mockMessage);

      // Wait a bit to ensure message would have been received if echo existed
      setTimeout(() => {
        expect(onMessageReceived).not.toHaveBeenCalled();
        service1.destroy();
      }, 50);
    });

    it('should broadcast message status updated to other tabs', (done: () => void) => {
      const service1 = new BroadcastChannelService();
      const service2 = new BroadcastChannelService();

      service2.setEventHandlers({
        onMessageStatusUpdated: (messageId, status) => {
          expect(messageId).toBe('msg-123');
          expect(status).toBe('read');
          service1.destroy();
          service2.destroy();
          done();
        },
      });

      service1.broadcastMessageStatusUpdated('msg-123', 'read');
    });

    it('should broadcast pagination completed to other tabs', (done: () => void) => {
      const service1 = new BroadcastChannelService();
      const service2 = new BroadcastChannelService();

      service2.setEventHandlers({
        onPaginationCompleted: (conversationId, messageCount, hasMore) => {
          expect(conversationId).toBe('conv-123');
          expect(messageCount).toBe(50);
          expect(hasMore).toBe(true);
          service1.destroy();
          service2.destroy();
          done();
        },
      });

      service1.broadcastPaginationCompleted('conv-123', 50, true);
    });

    it('should handle multiple tabs receiving broadcasts', (done: () => void) => {
      const service1 = new BroadcastChannelService();
      const service2 = new BroadcastChannelService();
      const service3 = new BroadcastChannelService();

      const mockMessage = createMockMessage({ content: 'Broadcast to all' });
      let receivedCount = 0;

      const handler = (message: Message) => {
        expect(message.id).toBe(mockMessage.id);
        receivedCount++;

        // Both service2 and service3 should receive (not service1)
        if (receivedCount === 2) {
          service1.destroy();
          service2.destroy();
          service3.destroy();
          done();
        }
      };

      service2.setEventHandlers({ onMessageReceived: handler });
      service3.setEventHandlers({ onMessageReceived: handler });

      service1.broadcastMessageReceived(mockMessage);
    });

    it('should handle rapid sequential broadcasts', (done: () => void) => {
      const service1 = new BroadcastChannelService();
      const service2 = new BroadcastChannelService();

      const receivedMessages: string[] = [];

      service2.setEventHandlers({
        onMessageReceived: (message) => {
          receivedMessages.push(message.id);

          if (receivedMessages.length === 5) {
            expect(receivedMessages).toEqual(['msg-1', 'msg-2', 'msg-3', 'msg-4', 'msg-5']);
            service1.destroy();
            service2.destroy();
            done();
          }
        },
      });

      // Send 5 messages rapidly
      for (let i = 1; i <= 5; i++) {
        service1.broadcastMessageReceived(createMockMessage({ id: `msg-${i}` }));
      }
    });
  });

  describe('Event Handlers', () => {
    it('should set event handlers correctly', () => {
      const onMessageReceived = vi.fn();
      const onMessageStatusUpdated = vi.fn();
      const onPaginationCompleted = vi.fn();

      service.setEventHandlers({
        onMessageReceived,
        onMessageStatusUpdated,
        onPaginationCompleted,
      });

      // biome-ignore lint/suspicious/noExplicitAny: Testing private property
      const handlers = (service as any).eventHandlers;

      expect(handlers.onMessageReceived).toBe(onMessageReceived);
      expect(handlers.onMessageStatusUpdated).toBe(onMessageStatusUpdated);
      expect(handlers.onPaginationCompleted).toBe(onPaginationCompleted);
    });

    it('should merge new handlers with existing ones', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      service.setEventHandlers({ onMessageReceived: handler1 });
      service.setEventHandlers({ onMessageStatusUpdated: handler2 });

      // biome-ignore lint/suspicious/noExplicitAny: Testing private property
      const handlers = (service as any).eventHandlers;

      expect(handlers.onMessageReceived).toBe(handler1);
      expect(handlers.onMessageStatusUpdated).toBe(handler2);
    });

    it('should handle undefined handlers gracefully', () => {
      const service1 = new BroadcastChannelService();
      const service2 = new BroadcastChannelService();

      // service2 has no handlers set
      expect(() => {
        service1.broadcastMessageReceived(createMockMessage());
      }).not.toThrow();

      service1.destroy();
      service2.destroy();
    });

    it('should call only the appropriate handler for message type', (done: () => void) => {
      const service1 = new BroadcastChannelService();
      const service2 = new BroadcastChannelService();

      const onMessageReceived = vi.fn();
      const onMessageStatusUpdated = vi.fn();
      const onPaginationCompleted = vi.fn();

      service2.setEventHandlers({
        onMessageReceived,
        onMessageStatusUpdated,
        onPaginationCompleted,
      });

      service1.broadcastMessageReceived(createMockMessage());

      setTimeout(() => {
        expect(onMessageReceived).toHaveBeenCalledTimes(1);
        expect(onMessageStatusUpdated).not.toHaveBeenCalled();
        expect(onPaginationCompleted).not.toHaveBeenCalled();

        service1.destroy();
        service2.destroy();
        done();
      }, 50);
    });
  });

  describe('Message Types', () => {
    it('should handle MESSAGE_RECEIVED type correctly', (done: () => void) => {
      const service1 = new BroadcastChannelService();
      const service2 = new BroadcastChannelService();

      const mockMessage = createMockMessage({
        id: 'test-msg',
        content: 'Test content',
        status: 'sent',
      });

      service2.setEventHandlers({
        onMessageReceived: (message) => {
          expect(message).toEqual(mockMessage);
          service1.destroy();
          service2.destroy();
          done();
        },
      });

      service1.broadcastMessageReceived(mockMessage);
    });

    it('should handle MESSAGE_STATUS_UPDATED type correctly', (done: () => void) => {
      const service1 = new BroadcastChannelService();
      const service2 = new BroadcastChannelService();

      service2.setEventHandlers({
        onMessageStatusUpdated: (messageId, status) => {
          expect(messageId).toBe('msg-abc');
          expect(status).toBe('delivered');
          service1.destroy();
          service2.destroy();
          done();
        },
      });

      service1.broadcastMessageStatusUpdated('msg-abc', 'delivered');
    });

    it('should handle PAGINATION_COMPLETED type correctly', (done: () => void) => {
      const service1 = new BroadcastChannelService();
      const service2 = new BroadcastChannelService();

      service2.setEventHandlers({
        onPaginationCompleted: (conversationId, messageCount, hasMore) => {
          expect(conversationId).toBe('conv-xyz');
          expect(messageCount).toBe(100);
          expect(hasMore).toBe(false);
          service1.destroy();
          service2.destroy();
          done();
        },
      });

      service1.broadcastPaginationCompleted('conv-xyz', 100, false);
    });

    it('should handle all status types', (done: () => void) => {
      const service1 = new BroadcastChannelService();
      const service2 = new BroadcastChannelService();

      const statuses: Message['status'][] = ['sending', 'sent', 'delivered', 'read', 'failed'];
      const receivedStatuses: Message['status'][] = [];

      service2.setEventHandlers({
        onMessageStatusUpdated: (_messageId, status) => {
          receivedStatuses.push(status);

          if (receivedStatuses.length === statuses.length) {
            expect(receivedStatuses).toEqual(statuses);
            service1.destroy();
            service2.destroy();
            done();
          }
        },
      });

      statuses.forEach((status) => {
        service1.broadcastMessageStatusUpdated('msg-test', status);
      });
    });
  });

  describe('Cleanup and Destruction', () => {
    it('should clean up channel on destroy', () => {
      const service = new BroadcastChannelService();
      // biome-ignore lint/suspicious/noExplicitAny: Testing private property
      const channel = (service as any).channel;

      expect(channel).toBeDefined();

      service.destroy();

      // biome-ignore lint/suspicious/noExplicitAny: Testing private property
      expect((service as any).channel).toBeNull();
    });

    it('should clear event handlers on destroy', () => {
      service.setEventHandlers({
        onMessageReceived: vi.fn(),
        onMessageStatusUpdated: vi.fn(),
      });

      service.destroy();

      // biome-ignore lint/suspicious/noExplicitAny: Testing private property
      const handlers = (service as any).eventHandlers;
      expect(Object.keys(handlers)).toHaveLength(0);
    });

    it('should not receive messages after destroy', (done: () => void) => {
      const service1 = new BroadcastChannelService();
      const service2 = new BroadcastChannelService();

      const onMessageReceived = vi.fn();
      service2.setEventHandlers({ onMessageReceived });

      service2.destroy();

      service1.broadcastMessageReceived(createMockMessage());

      setTimeout(() => {
        expect(onMessageReceived).not.toHaveBeenCalled();
        service1.destroy();
        done();
      }, 50);
    });

    it('should be safe to call destroy multiple times', () => {
      const service = new BroadcastChannelService();

      expect(() => {
        service.destroy();
        service.destroy();
        service.destroy();
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle broadcast errors gracefully', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const service = new BroadcastChannelService();

      // Force an error by mocking postMessage to throw
      // biome-ignore lint/suspicious/noExplicitAny: Testing private property
      const channel = (service as any).channel;
      if (channel) {
        channel.postMessage = vi.fn().mockImplementation(() => {
          throw new Error('Broadcast failed');
        });
      }

      // Should not throw - error should be caught
      expect(() => {
        service.broadcastMessageReceived(createMockMessage());
      }).not.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to broadcast message:',
        expect.any(Error)
      );

      service.destroy();
      consoleErrorSpy.mockRestore();
    });

    it('should handle unknown message types gracefully', (done: () => void) => {
      const service1 = new BroadcastChannelService();
      const service2 = new BroadcastChannelService();

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      service2.setEventHandlers({
        onMessageReceived: vi.fn(),
      });

      // Send an unknown message type via the internal channel
      // biome-ignore lint/suspicious/noExplicitAny: Testing private property
      const channel1 = (service1 as any).channel;
      if (channel1) {
        channel1.postMessage({
          type: 'UNKNOWN_TYPE',
          payload: {},
          // biome-ignore lint/suspicious/noExplicitAny: Testing private property
          tabId: (service1 as any).tabId,
        });
      }

      setTimeout(() => {
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          'Unknown broadcast message type:',
          'UNKNOWN_TYPE'
        );

        service1.destroy();
        service2.destroy();
        consoleWarnSpy.mockRestore();
        done();
      }, 50);
    });

    it('should not crash if handler throws error', (done: () => void) => {
      const service1 = new BroadcastChannelService();
      const service2 = new BroadcastChannelService();

      service2.setEventHandlers({
        onMessageReceived: () => {
          throw new Error('Handler error');
        },
      });

      // Should not throw - error is in the handler
      expect(() => {
        service1.broadcastMessageReceived(createMockMessage());
      }).not.toThrow();

      setTimeout(() => {
        service1.destroy();
        service2.destroy();
        done();
      }, 50);
    });
  });

  describe('Real-World Scenarios', () => {
    it('should sync message across 3 tabs when one receives from server', (done: () => void) => {
      const tab1 = new BroadcastChannelService(); // Receives from server
      const tab2 = new BroadcastChannelService(); // Should be notified
      const tab3 = new BroadcastChannelService(); // Should be notified

      const mockMessage = createMockMessage({ content: 'Server message' });
      const notifiedTabs: number[] = [];

      const handler = (message: Message) => {
        expect(message.id).toBe(mockMessage.id);
        notifiedTabs.push(notifiedTabs.length + 1);

        if (notifiedTabs.length === 2) {
          // Both tab2 and tab3 notified
          tab1.destroy();
          tab2.destroy();
          tab3.destroy();
          done();
        }
      };

      tab2.setEventHandlers({ onMessageReceived: handler });
      tab3.setEventHandlers({ onMessageReceived: handler });

      // Simulate tab1 receiving message from server and broadcasting
      tab1.broadcastMessageReceived(mockMessage);
    });

    it('should sync message status when user marks as read in one tab', (done: () => void) => {
      const activeTab = new BroadcastChannelService();
      const backgroundTab = new BroadcastChannelService();

      backgroundTab.setEventHandlers({
        onMessageStatusUpdated: (messageId, status) => {
          expect(messageId).toBe('msg-to-read');
          expect(status).toBe('read');
          activeTab.destroy();
          backgroundTab.destroy();
          done();
        },
      });

      // User marks message as read in active tab
      activeTab.broadcastMessageStatusUpdated('msg-to-read', 'read');
    });

    it('should handle pagination sync across tabs', (done: () => void) => {
      const scrollingTab = new BroadcastChannelService();
      const otherTab = new BroadcastChannelService();

      otherTab.setEventHandlers({
        onPaginationCompleted: (conversationId, messageCount, hasMore) => {
          expect(conversationId).toBe('conv-scrolled');
          expect(messageCount).toBe(25);
          expect(hasMore).toBe(true);
          scrollingTab.destroy();
          otherTab.destroy();
          done();
        },
      });

      // User scrolls and loads more messages in scrolling tab
      scrollingTab.broadcastPaginationCompleted('conv-scrolled', 25, true);
    });

    it('should handle tab closing and reopening scenario', (done: () => void) => {
      const tab1 = new BroadcastChannelService();
      const tab2 = new BroadcastChannelService();

      let receivedCount = 0;

      const handler = () => {
        receivedCount++;
      };

      tab2.setEventHandlers({ onMessageReceived: handler });

      // Send message - tab2 should receive
      tab1.broadcastMessageReceived(createMockMessage({ id: 'msg-1' }));

      setTimeout(() => {
        expect(receivedCount).toBe(1);

        // Tab2 closes
        tab2.destroy();

        // Send another message - tab2 should NOT receive
        tab1.broadcastMessageReceived(createMockMessage({ id: 'msg-2' }));

        setTimeout(() => {
          // Still only 1 received
          expect(receivedCount).toBe(1);

          // Tab2 reopens (new instance)
          const tab2New = new BroadcastChannelService();
          let newReceivedCount = 0;

          tab2New.setEventHandlers({
            onMessageReceived: () => {
              newReceivedCount++;
            },
          });

          // Send message - new tab2 should receive
          tab1.broadcastMessageReceived(createMockMessage({ id: 'msg-3' }));

          setTimeout(() => {
            expect(newReceivedCount).toBe(1);
            tab1.destroy();
            tab2New.destroy();
            done();
          }, 50);
        }, 50);
      }, 50);
    });
  });
});
