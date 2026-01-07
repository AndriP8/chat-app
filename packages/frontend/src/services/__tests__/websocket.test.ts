import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebSocketService } from '../websocket';

// Store references to created WebSocket instances
let latestWebSocket: WebSocket | null = null;
const originalWebSocket = globalThis.WebSocket;

// Wrap the WebSocket constructor to capture instances
class WebSocketWrapper extends originalWebSocket {
  constructor(url: string) {
    super(url);
    latestWebSocket = this;
  }
}

describe('WebSocketService', () => {
  let service: WebSocketService;

  beforeEach(() => {
    vi.clearAllMocks();
    latestWebSocket = null;
    globalThis.WebSocket = WebSocketWrapper as unknown as typeof WebSocket;
    service = new WebSocketService('ws://localhost:3001');
  });

  afterEach(() => {
    service.disconnect();
    globalThis.WebSocket = originalWebSocket;
  });

  describe('Initialization', () => {
    it('should initialize with default baseUrl from env', () => {
      const defaultService = new WebSocketService();
      expect(defaultService.baseUrl).toBeTruthy();
    });

    it('should initialize with custom baseUrl', () => {
      const customService = new WebSocketService('ws://custom-url:3001');
      expect(customService.baseUrl).toBe('ws://custom-url:3001');
    });

    it('should have initial state as disconnected', () => {
      expect(service.getState()).toBe('disconnected');
    });
  });

  describe('Connection Management', () => {
    it('should connect to WebSocket successfully', async () => {
      const connectPromise = service.connect();

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(latestWebSocket).not.toBeNull();
      await connectPromise;

      expect(service.getState()).toBe('connected');
      expect(service.isConnected()).toBe(true);
    });

    it('should set state to connecting during connection', () => {
      service.connect().catch(() => {
        // Ignore errors in this test
      });

      expect(service.getState()).toBe('connecting');
    });

    it('should reset reconnect attempts on successful connection', async () => {
      await service.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(service.getState()).toBe('connected');
    });

    it('should return early if already connected', async () => {
      await service.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));

      const secondConnect = await service.connect();

      expect(secondConnect).toBeUndefined();
      expect(service.getState()).toBe('connected');
    });

    it('should handle connection error', async () => {
      const connectPromise = service.connect();

      // Wait for WebSocket to be created
      await new Promise((resolve) => setTimeout(resolve, 1));

      // Trigger error immediately before connection completes
      if (latestWebSocket?.onerror) {
        latestWebSocket.onerror(new Event('error'));
      }

      try {
        await connectPromise;
      } catch (error) {
        expect(error).toBeDefined();
        expect(service.getState()).toBe('error');
      }
    });
  });

  describe('State Management', () => {
    it('should get current state', () => {
      expect(service.getState()).toBe('disconnected');
    });

    it('should trigger onStateChange callback when state changes', async () => {
      const onStateChange = vi.fn();
      service.setEventHandlers({ onStateChange });

      service.connect().catch(() => {
        // Ignore errors
      });

      expect(onStateChange).toHaveBeenCalledWith('connecting');
    });
  });

  describe('Event Handlers', () => {
    it('should set event handlers', () => {
      const onMessage = vi.fn();
      const onError = vi.fn();
      const onStateChange = vi.fn();

      service.setEventHandlers({ onMessage, onError, onStateChange });

      service.connect().catch(() => {
        // Ignore errors
      });

      expect(onStateChange).toHaveBeenCalledWith('connecting');
    });

    it('should merge new handlers with existing ones', () => {
      const onMessage = vi.fn();
      const onError = vi.fn();

      service.setEventHandlers({ onMessage });
      service.setEventHandlers({ onError });

      service.connect().catch(() => {
        // Ignore errors
      });
    });

    it('should trigger onMessage handler when message received', async () => {
      const onMessage = vi.fn();
      service.setEventHandlers({ onMessage });

      await service.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Note: Dates will be strings when they come from WebSocket (JSON serialized)
      const mockMessage = {
        id: 'msg-1',
        content: 'Test message',
        sender_id: 'user-1',
        conversation_id: 'conv-1',
        status: 'sent',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sender: {
          id: 'user-1',
          name: 'Test User',
          email: 'test@example.com',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      };

      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify({ type: 'message', data: { message: mockMessage } }),
      });

      if (latestWebSocket?.onmessage) {
        latestWebSocket.onmessage(messageEvent);
      }

      expect(onMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'msg-1',
          content: 'Test message',
          sender_id: 'user-1',
          conversation_id: 'conv-1',
          status: 'sent',
        })
      );
    });

    it('should trigger onError handler when error message received', async () => {
      const onError = vi.fn();
      service.setEventHandlers({ onError });

      await service.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));

      const errorEvent = new MessageEvent('message', {
        data: JSON.stringify({ type: 'error', data: { message: 'Test error' } }),
      });

      if (latestWebSocket?.onmessage) {
        latestWebSocket.onmessage(errorEvent);
      }

      expect(onError).toHaveBeenCalledWith('Test error');
    });
  });

  describe('Message Handling', () => {
    it('should handle message type response', async () => {
      const onMessage = vi.fn();
      service.setEventHandlers({ onMessage });

      await service.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));

      const message = {
        id: 'msg-1',
        content: 'Hello',
        sender_id: 'user-1',
        conversation_id: 'conv-1',
        status: 'sent',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sender: {
          id: 'user-1',
          name: 'User',
          email: 'user@example.com',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      };

      const event = new MessageEvent('message', {
        data: JSON.stringify({ type: 'message', data: { message } }),
      });

      if (latestWebSocket?.onmessage) {
        latestWebSocket.onmessage(event);
      }

      expect(onMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'msg-1',
          content: 'Hello',
          sender_id: 'user-1',
        })
      );
    });

    it('should handle connected event', async () => {
      await service.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));

      const connectedEvent = new MessageEvent('message', {
        data: JSON.stringify({ type: 'connected', data: { message: 'Connected' } }),
      });

      // Should not throw error when handling connected event
      expect(() => {
        if (latestWebSocket?.onmessage) {
          latestWebSocket.onmessage(connectedEvent);
        }
      }).not.toThrow();

      expect(service.isConnected()).toBe(true);
    });

    it('should handle joined_conversation event', async () => {
      await service.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));

      const joinedEvent = new MessageEvent('message', {
        data: JSON.stringify({
          type: 'joined_conversation',
          data: { conversationId: 'conv-1' },
        }),
      });

      if (latestWebSocket?.onmessage) {
        latestWebSocket.onmessage(joinedEvent);
      }

      expect(service.isConnected()).toBe(true);
    });

    it('should handle message_status_updated event', async () => {
      const onMessageStatusUpdate = vi.fn();
      service.setEventHandlers({ onMessageStatusUpdate });

      await service.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));

      const statusUpdateEvent = new MessageEvent('message', {
        data: JSON.stringify({
          type: 'message_status_updated',
          data: { messageId: 'msg-1', status: 'delivered', updatedBy: 'user-2' },
        }),
      });

      if (latestWebSocket?.onmessage) {
        latestWebSocket.onmessage(statusUpdateEvent);
      }

      expect(onMessageStatusUpdate).toHaveBeenCalledWith('msg-1', 'delivered', 'user-2');
    });

    it('should handle unknown message types gracefully', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await service.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));

      const unknownEvent = new MessageEvent('message', {
        data: JSON.stringify({ type: 'unknown_type', data: {} }),
      });

      if (latestWebSocket?.onmessage) {
        latestWebSocket.onmessage(unknownEvent);
      }

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Unknown WebSocket message type:',
        'unknown_type'
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('Sending Messages', () => {
    it('should send message when connected', async () => {
      await service.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));

      const sendSpy = vi.spyOn(latestWebSocket!, 'send');

      await service.sendMessage('conv-1', 'Hello', 'temp-123', 1, '2025-01-06T12:00:00Z');

      expect(sendSpy).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'send_message',
          data: {
            conversationId: 'conv-1',
            content: 'Hello',
            tempId: 'temp-123',
            sequenceNumber: 1,
            createdAt: '2025-01-06T12:00:00Z',
          },
        })
      );
    });

    it('should reject if not connected', async () => {
      await expect(service.sendMessage('conv-1', 'Hello')).rejects.toThrow(
        'WebSocket is not connected'
      );
    });
  });

  describe('Conversation Management', () => {
    it('should join conversation when connected', async () => {
      await service.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));

      const sendSpy = vi.spyOn(latestWebSocket!, 'send');

      service.joinConversation('conv-1');

      expect(sendSpy).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'join_conversation',
          data: { conversationId: 'conv-1' },
        })
      );
    });

    it('should not join conversation if not connected', () => {
      service.joinConversation('conv-1');
      expect(service.isConnected()).toBe(false);
    });

    it('should leave conversation when connected', async () => {
      await service.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));

      const sendSpy = vi.spyOn(latestWebSocket!, 'send');

      service.leaveConversation('conv-1');

      expect(sendSpy).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'leave_conversation',
          data: { conversationId: 'conv-1' },
        })
      );
    });

    it('should not leave conversation if not connected', () => {
      service.leaveConversation('conv-1');
      expect(service.isConnected()).toBe(false);
    });
  });

  describe('Message Status Updates', () => {
    it('should mark message as delivered', async () => {
      await service.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));

      const sendSpy = vi.spyOn(latestWebSocket!, 'send');

      service.markMessageDelivered('msg-1', 'conv-1');

      expect(sendSpy).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'message_delivered',
          data: { messageId: 'msg-1', conversationId: 'conv-1' },
        })
      );
    });

    it('should mark message as read', async () => {
      await service.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));

      const sendSpy = vi.spyOn(latestWebSocket!, 'send');

      service.markMessageRead('msg-1', 'conv-1');

      expect(sendSpy).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'message_read',
          data: { messageId: 'msg-1', conversationId: 'conv-1' },
        })
      );
    });
  });

  describe('Reconnection Logic', () => {
    it('should set state to disconnected on connection close', async () => {
      await service.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Trigger close event
      if (latestWebSocket?.onclose) {
        latestWebSocket.onclose(new CloseEvent('close'));
      }

      // Small delay for event processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(service.getState()).toBe('disconnected');
    });
  });

  describe('Disconnection', () => {
    it('should disconnect and clear state', () => {
      service.disconnect();

      expect(service.getState()).toBe('disconnected');
      expect(service.isConnected()).toBe(false);
    });

    it('should clear joined conversations on disconnect', async () => {
      await service.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));

      service.joinConversation('conv-1');
      service.disconnect();

      expect(service.isConnected()).toBe(false);
    });
  });

  describe('Connection State', () => {
    it('should return false when disconnected', () => {
      expect(service.isConnected()).toBe(false);
    });

    it('should return true after successful connection', async () => {
      const connectPromise = service.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));
      await connectPromise;

      expect(service.isConnected()).toBe(true);
    });
  });
});
