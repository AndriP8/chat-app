import type { Message } from '@/types/chat';

// WebSocket message types based on backend implementation
interface WebSocketMessage {
  type: 'send_message' | 'join_conversation' | 'leave_conversation';
  data: SendMessageData | ConversationData | Record<string, unknown>;
}

interface SendMessageData {
  conversationId: string;
  content: string;
  tempId?: string;
}

interface ConversationData {
  conversationId: string;
}

// WebSocket response types
interface WebSocketResponse {
  type: 'message' | 'error' | 'connected' | 'joined_conversation';
  data: MessageResponseData | ErrorResponseData | ConnectedResponseData | JoinedConversationData;
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
}

export class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private state: WebSocketState = 'disconnected';
  private eventHandlers: WebSocketEventHandlers = {};
  private joinedConversations = new Set<string>();
  baseUrl: string;

  constructor(baseUrl = 'ws://localhost:3001') {
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
          this.reconnectAttempts = 0;
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

        this.ws.onclose = (event) => {
          this.setState('disconnected');

          // Attempt to reconnect if not a clean close
          if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
            setTimeout(
              () => {
                this.reconnectAttempts++;
                this.connect().catch(console.error);
              },
              this.reconnectDelay * 2 ** this.reconnectAttempts
            );
          }
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
        this.rejoinConversations();
        break;
      }
      case 'joined_conversation': {
        const data = response.data as JoinedConversationData;
        this.joinedConversations.add(data.conversationId);
        break;
      }
      default:
        console.warn('Unknown WebSocket message type:', response.type);
    }
  }

  private rejoinConversations(): void {
    // Rejoin all previously joined conversations after reconnection
    for (const conversationId of this.joinedConversations) {
      this.joinConversation(conversationId);
    }
  }

  public sendMessage(conversationId: string, content: string, tempId?: string): Promise<void> {
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
      // Store for later when connected
      this.joinedConversations.add(conversationId);
      return;
    }

    const message: WebSocketMessage = {
      type: 'join_conversation',
      data: {
        conversationId,
      },
    };

    this.ws.send(JSON.stringify(message));
    this.joinedConversations.add(conversationId);
  }

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
