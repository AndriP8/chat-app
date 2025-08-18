import { useReducer, useEffect, useCallback, useRef } from 'react';
import { conversationApi } from '@/services/api';
import { webSocketService } from '@/services/websocket';
import { useAuth } from '@/components/auth/AuthContext';
import type { ChatRoom, Message, UIMessage } from '@/types/chat';
import { conversationsReducer, initialConversationsState } from '@/reducers/conversationsReducer';

export interface UseConversationsErrors {
  conversations?: string;
  messages?: Record<string, string>; // per conversation ID
  send?: string;
  create?: string;
}

export interface UseConversationsReturn {
  conversations: ChatRoom[];
  messages: Record<string, UIMessage[]>;
  // Granular loading states
  loading: {
    conversations: boolean;
    messages: Record<string, boolean>;
    send: boolean;
    create: boolean;
  };
  errors: UseConversationsErrors;
  // Actions
  loadMessages: (conversationId: string) => Promise<void>;
  sendMessage: (conversationId: string, content: string, tempId?: string) => Promise<void>;
}

export function useWebSocketConversations(): UseConversationsReturn {
  const [state, dispatch] = useReducer(conversationsReducer, initialConversationsState);
  const { currentUser } = useAuth();
  const isConnectingRef = useRef(false);
  const currentConversationRef = useRef<string | null>(null);

  const { conversations, messages, loading, errors } = state;
  const messagesRef = useRef(messages);

  // Update ref when messages change
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Handle incoming WebSocket messages
  const handleWebSocketMessage = useCallback((message: Message) => {
    const conversationMessages = messagesRef.current[message.conversation_id] || [];
    const tempMessage = conversationMessages.find(
      (msg) =>
        msg.isTemporary &&
        msg.sender_id === message.sender_id &&
        msg.content === message.content &&
        // Check if the message was sent within the last 30 seconds
        new Date().getTime() - new Date(msg.created_at).getTime() < 30000
    );

    if (tempMessage) {
      // Replace the temporary message with the real one
      dispatch({
        type: 'UPDATE_MESSAGE',
        payload: {
          conversationId: message.conversation_id,
          messageId: tempMessage.id,
          updates: {
            ...message,
            sendingStatus: 'sent',
            isTemporary: false,
            retryCount: 0,
          },
        },
      });
    } else {
      // Add new message (from other users or if no temp message found)
      dispatch({
        type: 'ADD_MESSAGE',
        payload: {
          conversationId: message.conversation_id,
          message: {
            ...message,
            sendingStatus: 'sent' as const,
            isTemporary: false,
            retryCount: 0,
          },
        },
      });
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
  }, []);

  // Initialize WebSocket connection and event handlers
  useEffect(() => {
    const initializeWebSocket = async () => {
      if (isConnectingRef.current) return;
      isConnectingRef.current = true;

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
          onStateChange: (state) => {
            console.log('WebSocket state changed:', state);
          },
        });

        // Connect to WebSocket
        await webSocketService.connect();
      } catch (error) {
        console.error('Failed to initialize WebSocket:', error);
      } finally {
        isConnectingRef.current = false;
      }
    };

    initializeWebSocket();

    return () => {
      webSocketService.disconnect();
    };
  }, [handleWebSocketMessage]);

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

  // Load conversations on mount
  const refreshConversations = useCallback(async () => {
    try {
      dispatch({
        type: 'SET_LOADING',
        payload: { type: 'conversations', loading: true },
      });
      dispatch({
        type: 'CLEAR_ERROR',
        payload: { type: 'conversations' },
      });
      const data = await conversationApi.getConversations();
      dispatch({
        type: 'SET_CONVERSATIONS',
        payload: data.data,
      });
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

  // Send a message using WebSocket with fallback to HTTP
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
        status: 'sent',
        created_at: new Date(),
        updated_at: new Date(),
        isTemporary: true,
        sendingStatus: 'sending',
        retryCount: 0,
      };

      try {
        dispatch({
          type: 'SET_LOADING',
          payload: { type: 'send', loading: true },
        });
        dispatch({
          type: 'CLEAR_ERROR',
          payload: { type: 'send' },
        });

        // Add temporary message immediately for optimistic UI
        dispatch({
          type: 'ADD_MESSAGE',
          payload: { conversationId, message: tempMessage },
        });

        // Try WebSocket first, fallback to HTTP if WebSocket is not available
        if (webSocketService.isConnected()) {
          joinConversation(conversationId);

          await webSocketService.sendMessage(conversationId, content, tempId);
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
              sendingStatus: 'failed' as const,
              error: errorMessage,
              retryCount: (tempMessage.retryCount || 0) + 1,
            },
          },
        });

        dispatch({
          type: 'SET_ERROR',
          payload: { type: 'send', error: errorMessage },
        });
        throw err;
      } finally {
        dispatch({
          type: 'SET_LOADING',
          payload: { type: 'send', loading: false },
        });
      }
    },
    [joinConversation, currentUser]
  );

  // Load conversations on mount
  useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);

  return {
    conversations,
    messages,
    loading: {
      conversations: loading.conversations,
      messages: loading.messages,
      send: loading.send,
      create: loading.create,
    },
    errors,
    loadMessages,
    sendMessage,
  };
}
