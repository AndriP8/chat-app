import { useCallback, useEffect, useReducer, useRef } from 'react';
import { useAuth } from '@/components/auth/AuthContext';
import { conversationsReducer, initialConversationsState } from '@/reducers/conversationsReducer';
import { broadcastChannelService } from '@/services/broadcastChannel';
import { dbOps } from '@/services/databaseOperations';
import { dataSyncer } from '@/services/dataSyncer';
import { webSocketService } from '@/services/websocket';
import type { ChatRoom, UIMessage } from '@/types/chat';
import type { Message as DatabaseMessage } from '@/types/database';
import { ensureDate } from '@/utils/helpers';
export interface UseConversationsReturn {
  conversations: ChatRoom[];
  messages: Record<string, UIMessage[]>;
  loading: {
    conversations: boolean;
    messages: Record<string, boolean>;
    loadingMore: Record<string, boolean>;
  };
  pagination: {
    hasMore: Record<string, boolean>;
  };
  error: {
    conversations?: string;
    messages?: Record<string, string>;
    send?: string;
  };
  loadConversations: () => Promise<void>;
  loadMessages: (conversationId: string) => Promise<void>;
  loadMoreMessages: (conversationId: string) => Promise<void>;
  sendMessage: (conversationId: string, content: string) => Promise<void>;
}

export function useWebSocketConversations(): UseConversationsReturn {
  const [state, dispatch] = useReducer(conversationsReducer, initialConversationsState);
  const { currentUser } = useAuth();
  const currentConversationRef = useRef<string | null>(null);

  // Message deduplication tracking
  const processedMessagesRef = useRef<Set<string>>(new Set());
  const processedStatusUpdatesRef = useRef<Set<string>>(new Set());

  // Cleanup refs periodically to prevent memory leaks
  useEffect(() => {
    const MAX_TRACKED_ITEMS = 10000;
    const CLEANUP_INTERVAL = 60000;

    const cleanupInterval = setInterval(() => {
      if (processedMessagesRef.current.size > MAX_TRACKED_ITEMS) {
        const entries = Array.from(processedMessagesRef.current);
        processedMessagesRef.current = new Set(entries.slice(Math.floor(entries.length / 2)));
      }

      if (processedStatusUpdatesRef.current.size > MAX_TRACKED_ITEMS) {
        const entries = Array.from(processedStatusUpdatesRef.current);
        processedStatusUpdatesRef.current = new Set(entries.slice(Math.floor(entries.length / 2)));
      }
    }, CLEANUP_INTERVAL);

    return () => clearInterval(cleanupInterval);
  }, []);

  const { conversations, messages, loading, errors, pagination } = state;
  const messagesRef = useRef(messages);

  // Update ref when messages change
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const handleDataSyncerMessage = useCallback(
    async (message: DatabaseMessage) => {
      try {
        const messageKey = message.id || message.tempId;
        if (!messageKey || processedMessagesRef.current.has(messageKey)) return;

        // Mark as processed
        processedMessagesRef.current.add(messageKey);

        const sender = await dbOps.getUser(message.senderId);
        if (!sender) return;

        const uiMessage: UIMessage = {
          ...message,
          sender,
          isTemporary: false,
          retryCount: 0,
          createdAt: ensureDate(message.createdAt),
          updatedAt: ensureDate(message.updatedAt),
        };

        if (message.tempId && sender.id === currentUser?.id) {
          // Replace temporary message with server response in current conversation sender
          dispatch({
            type: 'REPLACE_TEMP_MESSAGE',
            payload: {
              conversationId: message.conversationId,
              tempId: message.tempId,
              message: uiMessage,
            },
          });
        } else {
          // Add new message from sender to receiver conversation
          dispatch({
            type: 'ADD_MESSAGE',
            payload: {
              conversationId: message.conversationId,
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
        const statusUpdateKey = `${messageId}-${status}`;

        if (processedStatusUpdatesRef.current.has(statusUpdateKey)) return;

        processedStatusUpdatesRef.current.add(statusUpdateKey);

        for (const [conversationId, conversationMessages] of Object.entries(messagesRef.current)) {
          const messageIndex = conversationMessages.findIndex(
            (msg) => msg.id === messageId || msg.tempId === messageId
          );
          if (messageIndex !== -1) {
            const message = conversationMessages[messageIndex];
            const updates: Partial<UIMessage> = { status };
            // Add timestamps for status transitions
            const now = new Date();
            if (status === 'sent' && !message.sentAt) {
              updates.sentAt = now;
            } else if (status === 'delivered' && !message.deliveredAt) {
              updates.deliveredAt = now;
            } else if (status === 'read' && !message.readAt) {
              updates.readAt = now;
            }

            dispatch({
              type: 'UPDATE_MESSAGE',
              payload: {
                conversationId,
                messageId: message.id,
                updates,
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

  // Handle pagination completed from other tabs
  const handlePaginationCompleted = useCallback(
    async (conversationId: string, _messageCount: number, hasMore: boolean) => {
      const localMessages = await dbOps.getConversationMessages(conversationId, { limit: 1000 });

      const uiMessages = [];
      for (const message of localMessages) {
        const sender = await dbOps.getUser(message.senderId);
        if (sender) {
          uiMessages.push({
            ...message,
            sender,
          });
        }
      }

      dispatch({
        type: 'SET_MESSAGES',
        payload: { conversationId, messages: uiMessages, hasMore },
      });
    },
    []
  );

  useEffect(() => {
    dataSyncer.on('messageReceived', handleDataSyncerMessage);
    dataSyncer.on('messageStatusUpdated', handleDataSyncerStatusUpdate);

    // BroadcastChannel listeners for cross-tab synchronization
    broadcastChannelService.setEventHandlers({
      onMessageReceived: handleDataSyncerMessage,
      onMessageStatusUpdated: handleDataSyncerStatusUpdate,
      onPaginationCompleted: handlePaginationCompleted,
    });

    return () => {
      dataSyncer.off('messageReceived');
      dataSyncer.off('messageStatusUpdated');
      broadcastChannelService.destroy();
    };
  }, [handleDataSyncerMessage, handleDataSyncerStatusUpdate, handlePaginationCompleted]);

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
        const { messages, hasMore } = await dataSyncer.loadMessages(conversationId, 50);

        dispatch({
          type: 'SET_MESSAGES',
          payload: { conversationId, messages, hasMore },
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

  // Load more (older) messages for pagination
  const loadMoreMessages = useCallback(
    async (conversationId: string) => {
      try {
        const currentMessages = messages[conversationId];
        const isNoMessages = !currentMessages || currentMessages.length === 0;
        const isLoadingMore = loading.loadingMore[conversationId];
        const isNoMoreMessage = pagination.hasMore[conversationId] === false;

        if (isNoMessages || isLoadingMore || isNoMoreMessage) return;

        dispatch({
          type: 'LOAD_MORE_MESSAGES_START',
          payload: { conversationId },
        });

        const oldestMessage = currentMessages[0];
        const { messages: olderMessages, hasMore } = await dataSyncer.loadMoreMessages(
          conversationId,
          oldestMessage.id,
          50
        );

        dispatch({
          type: 'LOAD_MORE_MESSAGES_SUCCESS',
          payload: { conversationId, messages: olderMessages, hasMore },
        });
      } catch (err) {
        console.error('Failed to load more messages:', err);
        dispatch({
          type: 'LOAD_MORE_MESSAGES_FAILURE',
          payload: {
            conversationId,
            error: err instanceof Error ? err.message : 'Failed to load more messages',
          },
        });
      }
    },
    [messages, loading.loadingMore, pagination.hasMore]
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
        senderId: currentUser.id,
        conversationId: conversationId,
        sender: {
          id: currentUser.id,
          name: currentUser.name || 'Unknown User',
          email: currentUser.email,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        status: 'sending',
        createdAt: new Date(),
        updatedAt: new Date(),
        isTemporary: true,
      };
      try {
        dispatch({
          type: 'ADD_MESSAGE',
          payload: { conversationId, message: tempMessage },
        });

        if (webSocketService.isConnected()) {
          joinConversation(conversationId);
        }
        await dataSyncer.sendMessage(conversationId, content, tempId, currentUser.id);
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
      loadingMore: loading.loadingMore,
    },
    pagination: {
      hasMore: pagination.hasMore,
    },
    error: {
      conversations: errors.conversations,
      messages: errors.messages,
      send: errors.send,
    },
    loadConversations,
    loadMessages,
    loadMoreMessages,
    sendMessage,
  };
}
