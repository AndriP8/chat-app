import type { Message } from '@/types/chat';

// WebSocket message types based on backend implementation
interface WebSocketMessage {
  type:
    | 'send_message'
    | 'join_conversation'
    | 'leave_conversation'
    | 'message_delivered'
    | 'message_read';
  data: SendMessageData | ConversationData | MessageStatusData | Record<string, unknown>;
}

interface MessageStatusData {
  messageId: string;
  conversationId: string;
}

interface SendMessageData {
  conversationId: string;
  content: string;
  tempId?: string;
  sequenceNumber?: number;
  createdAt?: string;
}

interface ConversationData {
  conversationId: string;
}

// WebSocket response types
interface WebSocketResponse {
  type:
    | 'message'
    | 'error'
    | 'warning'
    | 'connected'
    | 'joined_conversation'
    | 'message_status_updated'
    | 'message_buffered';
  data:
    | MessageResponseData
    | ErrorResponseData
    | ConnectedResponseData
    | JoinedConversationData
    | MessageStatusUpdatedData
    | MessageBufferedData;
}

interface MessageStatusUpdatedData {
  messageId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  updatedBy: string;
}

interface MessageBufferedData {
  tempId?: string;
  messageId: string;
  sequenceNumber?: number;
  status: 'buffered';
}

interface MessageResponseData {
  message: Message;
}

interface ErrorResponseData {
  message: string;
  details?: Record<string, string[]>;
}
interface ConnectedResponseData {
  message: string;
}

interface JoinedConversationData {
  conversationId: string;
}

// WebSocket connection states
export type WebSocketState = 'connecting' | 'connected' | 'disconnected' | 'error';

// Event handlers
export interface WebSocketEventHandlers {
  onMessage?: (message: Message) => void;
  onError?: (error: string) => void;
  onStateChange?: (state: WebSocketState) => void;
  onMessageStatusUpdate?: (messageId: string, status: Message['status'], updatedBy: string) => void;
}

export class WebSocketService {
  private ws: WebSocket | null = null;
  private state: WebSocketState = 'disconnected';
  private eventHandlers: WebSocketEventHandlers = {};
  private joinedConversations = new Set<string>();
  baseUrl: string;

  constructor(baseUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001') {
    this.baseUrl = baseUrl;
  }

  private setState(newState: WebSocketState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.eventHandlers.onStateChange?.(newState);
    }
  }

  public getState(): WebSocketState {
    return this.state;
  }

  public setEventHandlers(handlers: WebSocketEventHandlers): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this.setState('connecting');

      // Construct WebSocket URL with auth token
      const wsUrl = `${this.baseUrl}/ws`;

      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          this.setState('connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const response: WebSocketResponse = JSON.parse(event.data);
            this.handleMessage(response);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onclose = () => {
          this.setState('disconnected');
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.setState('error');
          reject(new Error('WebSocket connection failed'));
        };
      } catch (error) {
        this.setState('error');
        reject(error);
      }
    });
  }

  private handleMessage(response: WebSocketResponse): void {
    switch (response.type) {
      case 'message': {
        const data = response.data as MessageResponseData;
        this.eventHandlers.onMessage?.(data.message);
        break;
      }
      case 'error': {
        const data = response.data as ErrorResponseData;
        this.eventHandlers.onError?.(data.message);
        break;
      }
      case 'connected': {
        for (const conversationId of this.joinedConversations) {
          this.joinConversation(conversationId);
        }
        break;
      }
      case 'joined_conversation': {
        const data = response.data as JoinedConversationData;
        this.joinedConversations.add(data.conversationId);
        break;
      }
      case 'message_status_updated': {
        const data = response.data as MessageStatusUpdatedData;
        this.eventHandlers.onMessageStatusUpdate?.(data.messageId, data.status, data.updatedBy);
        break;
      }
      default:
        console.warn('Unknown WebSocket message type:', response.type);
    }
  }

  public sendMessage(
    conversationId: string,
    content: string,
    tempId?: string,
    sequenceNumber?: number,
    createdAt?: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket is not connected'));
        return;
      }

      const message: WebSocketMessage = {
        type: 'send_message',
        data: {
          conversationId,
          content,
          tempId,
          sequenceNumber,
          createdAt,
        },
      };

      try {
        this.ws.send(JSON.stringify(message));
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  public joinConversation(conversationId: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const message: WebSocketMessage = {
      type: 'join_conversation',
      data: {
        conversationId,
      },
    };

    this.ws.send(JSON.stringify(message));
  }

  // Not used
  public leaveConversation(conversationId: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const message: WebSocketMessage = {
      type: 'leave_conversation',
      data: {
        conversationId,
      },
    };

    this.ws.send(JSON.stringify(message));
    this.joinedConversations.delete(conversationId);
  }

  public markMessageDelivered(messageId: string, conversationId: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const message: WebSocketMessage = {
      type: 'message_delivered',
      data: {
        messageId,
        conversationId,
      },
    };

    this.ws.send(JSON.stringify(message));
  }

  public markMessageRead(messageId: string, conversationId: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const message: WebSocketMessage = {
      type: 'message_read',
      data: {
        messageId,
        conversationId,
      },
    };

    this.ws.send(JSON.stringify(message));
  }

  public disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.setState('disconnected');
    this.joinedConversations.clear();
  }

  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Singleton instance
export const webSocketService = new WebSocketService();
