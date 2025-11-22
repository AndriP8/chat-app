import type { Message } from '@/types/database';

export type TabSyncMessage =
  | {
      type: 'MESSAGE_RECEIVED';
      payload: {
        message: Message;
      };
      tabId: string;
    }
  | {
      type: 'MESSAGE_STATUS_UPDATED';
      payload: {
        messageId: string;
        status: Message['status'];
      };
      tabId: string;
    }
  | {
      type: 'PAGINATION_COMPLETED';
      payload: {
        conversationId: string;
        messageCount: number;
        hasMore: boolean;
      };
      tabId: string;
    };

export interface BroadcastEventHandlers {
  onMessageReceived?: (message: Message) => void;
  onMessageStatusUpdated?: (messageId: string, status: Message['status']) => void;
  onPaginationCompleted?: (conversationId: string, messageCount: number, hasMore: boolean) => void;
  onUserTyping?: (conversationId: string, userId: string) => void;
  onUserStoppedTyping?: (conversationId: string, userId: string) => void;
}

export class BroadcastChannelService {
  private channel: BroadcastChannel | null = null;
  private readonly channelName = 'chat-app-sync';
  private readonly tabId: string;
  private eventHandlers: BroadcastEventHandlers = {};
  private isSupported: boolean;

  constructor() {
    // Generate unique tab ID to prevent processing own messages, example: tab_1694532456789_abcdef1234
    this.tabId = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    this.isSupported = typeof BroadcastChannel !== 'undefined';

    if (this.isSupported) {
      this.initialize();
    } else {
      console.warn('BroadcastChannel not supported in this browser. Cross-tab sync disabled.');
    }
  }

  /**
   * Initialize the BroadcastChannel and set up message listener
   */
  private initialize(): void {
    if (!this.isSupported) return;

    try {
      this.channel = new BroadcastChannel(this.channelName);
      this.channel.addEventListener('message', this.handleBroadcastMessage);
    } catch (error) {
      console.error('Failed to initialize BroadcastChannel:', error);
      this.isSupported = false;
    }
  }

  /**
   * Handle incoming broadcast messages from other tabs
   */
  private handleBroadcastMessage = (event: MessageEvent<TabSyncMessage>): void => {
    const { type, payload, tabId } = event.data;

    // Ignore messages from the same tab to prevent loops
    if (tabId === this.tabId) {
      return;
    }

    switch (type) {
      case 'MESSAGE_RECEIVED':
        this.eventHandlers.onMessageReceived?.(payload.message);
        break;
      case 'MESSAGE_STATUS_UPDATED':
        this.eventHandlers.onMessageStatusUpdated?.(payload.messageId, payload.status);
        break;
      case 'PAGINATION_COMPLETED':
        this.eventHandlers.onPaginationCompleted?.(
          payload.conversationId,
          payload.messageCount,
          payload.hasMore
        );
        break;
      default:
        console.warn('Unknown broadcast message type:', type);
    }
  };

  /**
   * Broadcast a message to all other tabs with type-safe payload
   */
  private broadcast<T extends TabSyncMessage>(message: T): void {
    if (!this.isSupported || !this.channel) {
      return;
    }

    try {
      this.channel.postMessage(message);
    } catch (error) {
      console.error('Failed to broadcast message:', error);
    }
  }

  /**
   * Broadcast that a new message was received
   */
  broadcastMessageReceived(message: Message): void {
    this.broadcast({
      type: 'MESSAGE_RECEIVED',
      payload: { message },
      tabId: this.tabId,
    });
  }

  /**
   * Broadcast that a message status was updated
   */
  broadcastMessageStatusUpdated(messageId: string, status: Message['status']): void {
    this.broadcast({
      type: 'MESSAGE_STATUS_UPDATED',
      payload: { messageId, status },
      tabId: this.tabId,
    });
  }

  /**
   * Broadcast that pagination has completed
   */
  broadcastPaginationCompleted(
    conversationId: string,
    messageCount: number,
    hasMore: boolean
  ): void {
    this.broadcast({
      type: 'PAGINATION_COMPLETED',
      payload: { conversationId, messageCount, hasMore },
      tabId: this.tabId,
    });
  }

  /**
   * Set event handlers for broadcast messages
   */
  setEventHandlers(handlers: BroadcastEventHandlers): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.channel) {
      this.channel.removeEventListener('message', this.handleBroadcastMessage);
      this.channel.close();
      this.channel = null;
    }
    this.eventHandlers = {};
  }
}

export const broadcastChannelService = new BroadcastChannelService();
