import { useReducer, useEffect, useCallback, useRef, useState } from 'react';
import { conversationApi } from '@/services/api';
import { webSocketService } from '@/services/websocket';
import { useAuth } from '@/components/auth/AuthContext';
import { conversationsReducer, initialConversationsState } from '@/reducers/conversationsReducer';
import type { ChatRoom, UIMessage, Message } from '@/types/chat';
export interface UseConversationsReturn {
  conversations: ChatRoom[];
  messages: Record<string, UIMessage[]>;
  loading: {
    conversations: boolean;
    messages: Record<string, boolean>;
  };
  error: {
    conversations?: string;
    messages?: Record<string, string>;
    websocket?: string;
    send?: string;
  };
  loadConversations: () => Promise<void>;
  loadMessages: (conversationId: string) => Promise<void>;
  sendMessage: (conversationId: string, content: string) => Promise<void>;
}

export function useWebSocketConversations(): UseConversationsReturn {
  const [state, dispatch] = useReducer(conversationsReducer, initialConversationsState);
  const [wsError, setWsError] = useState<string>('');
  const { currentUser } = useAuth();
  const currentConversationRef = useRef<string | null>(null);

  const { conversations, messages, loading, errors } = state;
  const messagesRef = useRef(messages);

  // Update ref when messages change
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Handle incoming WebSocket messages
  const handleWebSocketMessage = useCallback(
    (message: Message) => {
      setTimeout(() => {
        const conversationMessages = messagesRef.current[message.conversation_id] || [];

        // Check if we already have this message (by tempId or actual id)
        const existingMessageIndex = conversationMessages.findIndex(
          (msg) =>
            (message.tempId && msg.tempId === message.tempId) ||
            msg.id === message.id
        );

        if (existingMessageIndex !== -1) {
          const existingMessage = conversationMessages[existingMessageIndex];

          // Only update if necessary (temporary message becoming permanent or status change)
          if (existingMessage.isTemporary || existingMessage.status !== message.status) {
            dispatch({
              type: 'UPDATE_MESSAGE',
              payload: {
                conversationId: message.conversation_id,
                messageId: existingMessage.id,
                updates: {
                  ...message,
                  id: message.id || existingMessage.id, // Keep existing ID if new one is missing
                  isTemporary: false,
                  retryCount: 0,
                },
              },
            });
          }
        } else {
          // This is a new message (likely from another user)
          dispatch({
            type: 'ADD_MESSAGE',
            payload: {
              conversationId: message.conversation_id,
              message: {
                ...message,
                isTemporary: false,
                retryCount: 0,
              },
            },
          });

          // If this is a message from another user, mark it as delivered and read
          if (currentUser && message.sender_id !== currentUser.id) {
            webSocketService.markMessageDelivered(message.id, message.conversation_id);
            // Also mark as read if we're viewing this conversation
          }

          // Update conversation's last message and timestamp
          dispatch({
            type: 'UPDATE_CONVERSATION',
            payload: {
              conversationId: message.conversation_id,
              updates: {
                last_message: message,
                updated_at: message.created_at.toISOString(),
              },
            },
          });
        }
      }, 100);
    },
    [currentUser]
  );

  // Handle message status updates
  const handleMessageStatusUpdate = useCallback((messageId: string, status: Message['status']) => {
    for (const [conversationId, conversationMessages] of Object.entries(messagesRef.current)) {
      const messageIndex = conversationMessages.findIndex((msg) => msg.id === messageId);
      if (messageIndex !== -1) {
        dispatch({
          type: 'UPDATE_MESSAGE',
          payload: {
            conversationId,
            messageId,
            updates: {
              status,
              ...(status === "sent" && { sentAt: new Date() }),
              ...(status === 'delivered' && { deliveredAt: new Date() }),
              ...(status === 'read' && { readAt: new Date() }),
            },
          },
        });

        break;
      }
    }
  }, []);

  useEffect(() => {
    const connectWebSocket = async () => {
      try {
        webSocketService.setEventHandlers({
          onMessage: handleWebSocketMessage,
          onError: (error) => {
            console.error('WebSocket error:', error);
            dispatch({
              type: 'SET_ERROR',
              payload: { type: 'send', error },
            });
          },
          onMessageStatusUpdate: handleMessageStatusUpdate,
        });
        await webSocketService.connect();
      } catch (error) {
        setWsError(error instanceof Error ? error.message : 'Failed to initialize WebSocket');
        console.error('Failed to initialize WebSocket:', error);
      }
    };

    connectWebSocket();

    return () => {
      webSocketService.disconnect();
    };
  }, [handleWebSocketMessage, handleMessageStatusUpdate]);
  // Join conversation when current conversation changes
  const joinConversation = useCallback((conversationId: string) => {
    if (currentConversationRef.current !== conversationId) {
      if (currentConversationRef.current) {
        webSocketService.leaveConversation(currentConversationRef.current);
      }

      // Join new conversation
      webSocketService.joinConversation(conversationId);
      currentConversationRef.current = conversationId;
    }
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      dispatch({
        type: 'SET_LOADING',
        payload: { type: 'conversations', loading: true },
      });
      const data = await conversationApi.getConversations();
      dispatch({ type: 'SET_CONVERSATIONS', payload: data.data });
    } catch (err) {
      console.error('Failed to load conversations:', err);
      dispatch({
        type: 'SET_ERROR',
        payload: {
          type: 'conversations',
          error: err instanceof Error ? err.message : 'Failed to load conversations',
        },
      });
    } finally {
      dispatch({
        type: 'SET_LOADING',
        payload: { type: 'conversations', loading: false },
      });
    }
  }, []);

  // Load messages for a specific conversation
  const loadMessages = useCallback(
    async (conversationId: string) => {
      try {
        dispatch({
          type: 'SET_LOADING',
          payload: { type: 'messages', loading: true, conversationId },
        });
        dispatch({
          type: 'CLEAR_ERROR',
          payload: { type: 'messages', conversationId },
        });
        const data = await conversationApi.getMessages(conversationId, {
          limit: 50,
        });
        dispatch({
          type: 'SET_MESSAGES',
          payload: { conversationId, messages: data.messages },
        });

        // Join the conversation for real-time updates
        joinConversation(conversationId);
      } catch (err) {
        console.error('Failed to load messages:', err);
        dispatch({
          type: 'SET_ERROR',
          payload: {
            type: 'messages',
            error: err instanceof Error ? err.message : 'Failed to load messages',
            conversationId,
          },
        });
      } finally {
        dispatch({
          type: 'SET_LOADING',
          payload: { type: 'messages', loading: false, conversationId },
        });
      }
    },
    [joinConversation]
  );

  const sendMessage = useCallback(
    async (conversationId: string, content: string) => {
      if (!content) {
        throw new Error('Message content cannot be empty');
      }
      if (content.length > 1000) {
        throw new Error('Message is too long (max 1000 characters)');
      }

      const tempId = `temp-${Date.now()}-${Math.random()}`;

      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      // Create temporary message for optimistic UI
      const tempMessage: UIMessage = {
        id: tempId,
        tempId,
        content,
        sender_id: currentUser.id,
        conversation_id: conversationId,
        sender: {
          id: currentUser.id,
          name: currentUser.name || 'Unknown User',
          email: currentUser.email,
          created_at: new Date(),
          updated_at: new Date(),
        },
        status: 'sending',
        created_at: new Date(),
        updated_at: new Date(),
        isTemporary: true,
      };

      try {
        // Optimistic update
        dispatch({
          type: 'ADD_MESSAGE',
          payload: { conversationId, message: tempMessage },
        });

        if (webSocketService.isConnected()) {
          // Delay sending to allow optimistic update to be seen
          setTimeout(async () => {
            joinConversation(conversationId);
            await webSocketService.sendMessage(conversationId, content, tempId);
          }, 200);
        }
      } catch (err) {
        console.error('Failed to send message:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to send message';

        dispatch({
          type: 'UPDATE_MESSAGE',
          payload: {
            conversationId,
            messageId: tempId,
            updates: {
              status: 'failed',
              error: errorMessage,
            },
          },
        });
        dispatch({
          type: 'SET_ERROR',
          payload: {
            type: 'send',
            error: errorMessage,
          },
        });
      }
    },
    [joinConversation, currentUser]
  );

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  return {
    conversations,
    messages,
    loading: {
      conversations: loading.conversations,
      messages: loading.messages,
    },
    error: {
      conversations: errors.conversations,
      messages: errors.messages,
      websocket: wsError,
      send: errors.send,
    },
    loadConversations,
    loadMessages,
    sendMessage,
  };
}
