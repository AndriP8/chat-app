import { useReducer, useEffect, useCallback, useRef } from 'react';
import { webSocketService } from '@/services/websocket';
import { useAuth } from '@/components/auth/AuthContext';
import { conversationsReducer, initialConversationsState } from '@/reducers/conversationsReducer';
import type { ChatRoom, UIMessage } from '@/types/chat';
import type { Message as DatabaseMessage } from '@/types/database';
import { dataSyncer } from '@/services/dataSyncer';
import { dbOps } from '@/services/databaseOperations';
import { ensureDate } from '@/utils/helpers';
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
    send?: string;
  };
  loadConversations: () => Promise<void>;
  loadMessages: (conversationId: string) => Promise<void>;
  sendMessage: (conversationId: string, content: string) => Promise<void>;
}

export function useWebSocketConversations(): UseConversationsReturn {
  const [state, dispatch] = useReducer(conversationsReducer, initialConversationsState);
  const { currentUser } = useAuth();
  const currentConversationRef = useRef<string | null>(null);

  const { conversations, messages, loading, errors } = state;
  const messagesRef = useRef(messages);

  // Update ref when messages change
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const handleDataSyncerMessage = useCallback(
    async (message: DatabaseMessage) => {
      try {
        const sender = await dbOps.getUser(message.sender_id);
        if (!sender) return;

        const uiMessage: UIMessage = {
          ...message,
          sender,
          isTemporary: false,
          retryCount: 0,
          created_at: ensureDate(message.created_at),
          updated_at: ensureDate(message.updated_at),
        };

        if (message.tempId && sender.id === currentUser?.id) {
          // Replace temporary message with server response in current conversation sender
          dispatch({
            type: 'REPLACE_TEMP_MESSAGE',
            payload: {
              conversationId: message.conversation_id,
              tempId: message.tempId,
              message: uiMessage,
            },
          });
        } else {
          // Add new message from sender to receiver conversation
          dispatch({
            type: 'ADD_MESSAGE',
            payload: {
              conversationId: message.conversation_id,
              message: uiMessage,
            },
          });
        }
      } catch (error) {
        console.error('Error handling dataSyncer message:', error);
      }
    },
    [currentUser]
  );

  const handleDataSyncerStatusUpdate = useCallback(
    async (messageId: string, status: DatabaseMessage['status']) => {
      try {
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
                  ...(status === 'sent' && { sentAt: new Date() }),
                  ...(status === 'delivered' && { deliveredAt: new Date() }),
                  ...(status === 'read' && { readAt: new Date() }),
                },
              },
            });
            break;
          }
        }
      } catch (error) {
        console.error('Error handling dataSyncer status update:', error);
      }
    },
    []
  );

  useEffect(() => {
    dataSyncer.on('messageReceived', handleDataSyncerMessage);
    dataSyncer.on('messageStatusUpdated', handleDataSyncerStatusUpdate);
    return () => {
      dataSyncer.off('messageReceived');
      dataSyncer.off('messageStatusUpdated');
    };
  }, [handleDataSyncerMessage, handleDataSyncerStatusUpdate]);

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
    if (!currentUser) {
      return;
    }
    try {
      dispatch({
        type: 'SET_LOADING',
        payload: { type: 'conversations', loading: true },
      });
      const conversations = await dataSyncer.loadConversations(currentUser.id);
      dispatch({ type: 'SET_CONVERSATIONS', payload: conversations });
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
  }, [currentUser]);

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
        const messages = await dataSyncer.loadMessages(conversationId, 50);

        dispatch({
          type: 'SET_MESSAGES',
          payload: { conversationId, messages },
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
        if (webSocketService.isConnected()) {
          // Delay sending to allow optimistic update to be seen
          setTimeout(async () => {
            joinConversation(conversationId);
            dataSyncer.sendMessage(conversationId, content, tempId);
            // Update data in UI
            dispatch({
              type: 'ADD_MESSAGE',
              payload: { conversationId, message: tempMessage },
            });
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
      send: errors.send,
    },
    loadConversations,
    loadMessages,
    sendMessage,
  };
}
