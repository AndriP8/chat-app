import type { ChatRoom, UIMessage } from '@/types/chat';
import { ensureDate } from '@/utils/helpers';
import type { Message, SendMessageRequest } from '../types/database';
import conversationApi from './api/conversations';
import { broadcastChannelService } from './broadcastChannel';
import { db } from './database';
import { dbOps } from './databaseOperations';
import { messageScheduler } from './messageScheduler';
import { getNextSequenceNumber } from './sequenceNumber';
import type { MessageBufferedData, WebSocketService } from './websocket';

export interface SyncEvents {
  messageReceived: (message: Message) => void;
  messageStatusUpdated: (messageId: string, status: Message['status']) => void;
}

export interface MessageStatusUpdate {
  messageId: string;
  status: Message['status'];
}

export class DataSyncer {
  private webSocketService: WebSocketService | null = null;
  private eventListeners: Partial<SyncEvents> = {};
  private isInitialized = false;
  private currentUserId: string | null = null;

  /**
   * Initialize the Data Syncer with WebSocket service
   */
  async initialize(webSocketService: WebSocketService, currentUserId?: string): Promise<void> {
    if (this.isInitialized) {
      console.warn('DataSyncer is already initialized');
      return;
    }

    this.webSocketService = webSocketService;
    this.currentUserId = currentUserId || null;

    messageScheduler.setSendMessageCallback(async (request: SendMessageRequest) => {
      if (!this.webSocketService) {
        throw new Error('WebSocket service not available');
      }

      const message = await dbOps.getMessageById(request.messageId);
      if (!message) {
        throw new Error(`Message with id ${request.messageId} not found`);
      }

      if (!this.webSocketService.isConnected()) {
        throw new Error('WebSocket is not connected');
      }

      await this.webSocketService.sendMessage(
        message.conversationId,
        message.content,
        message.id,
        message.sequenceNumber,
        message.createdAt.toISOString()
      );

      return {
        ...message,
        updatedAt: new Date(),
      };
    });

    this.setupWebSocketHandlers();

    // Start message scheduler
    messageScheduler.start();

    this.isInitialized = true;
  }

  /**
   * Shutdown the Data Syncer
   */
  shutdown(): void {
    messageScheduler.stop();
    this.webSocketService = null;
    this.eventListeners = {};
    this.isInitialized = false;
  }

  /**
   * Set up WebSocket event handlers
   */
  private setupWebSocketHandlers(): void {
    if (!this.webSocketService) return;

    try {
      this.webSocketService.setEventHandlers({
        onMessage: this.handleIncomingMessage,
        onError: (error) => {
          console.error('WebSocket error:', error);
        },
        onMessageStatusUpdate: (messageId, status) =>
          this.handleMessageStatusUpdate({ messageId, status }),
        onMessageBuffered: (data) => this.handleMessageBuffered(data),
      });
    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
    }
  }

  /**
   * Handle incoming message from WebSocket
   */
  private handleIncomingMessage = async (message: Message): Promise<void> => {
    if (!this.webSocketService) {
      throw new Error('WebSocket service not available');
    }
    if (message.tempId) {
      try {
        // Replace temporary message with server message
        const replacedMessage = await dbOps.replaceTemporaryMessage(message.tempId, message);

        // Clean up the send request for this message
        await messageScheduler.cleanupProcessedMessage(message.tempId);

        broadcastChannelService.broadcastMessageReceived(replacedMessage);

        // Notify UI about the ID change
        this.eventListeners.messageReceived?.({
          ...replacedMessage,
          tempId: message.tempId,
        });

        if (message.senderId !== this.currentUserId) {
          try {
            this.webSocketService.markMessageDelivered(message.id, message.conversationId);
          } catch (error) {
            console.error('Failed to mark message as delivered:', error);
          }
        }
      } catch (error) {
        console.error('Failed to replace temporary message:', error);
        // Fallback to regular upsert
        await dbOps.upsertMessage(message);

        broadcastChannelService.broadcastMessageReceived(message);

        this.eventListeners.messageReceived?.(message);
      }
    } else {
      // This is a new message from another user or a regular message
      await dbOps.upsertMessage(message);

      broadcastChannelService.broadcastMessageReceived(message);

      this.eventListeners.messageReceived?.(message);
    }
  };

  /**
   * Handle message buffered event from WebSocket
   * This means the server has accepted the message but it's queued for delivery
   */
  private async handleMessageBuffered(data: MessageBufferedData): Promise<void> {
    if (!data.tempId) {
      console.warn('[DEBUG] message_buffered event missing tempId, cannot update local message');
      return;
    }

    try {
      const tempMessage = await dbOps.getMessageByTempId(data.tempId);

      if (!tempMessage) {
        return;
      }

      const updatedMessage: Message = {
        ...tempMessage,
        id: data.messageId,
        status: 'sent',
        sequenceNumber: data.sequenceNumber ?? tempMessage.sequenceNumber,
        updatedAt: new Date(),
      };

      const replacedMessage = await dbOps.replaceTemporaryMessage(data.tempId, updatedMessage);

      await messageScheduler.cleanupProcessedMessage(data.tempId);

      broadcastChannelService.broadcastMessageReceived(replacedMessage);

      this.eventListeners.messageReceived?.({
        ...replacedMessage,
        tempId: data.tempId,
      });
    } catch (error) {
      console.error('Error handling message_buffered:', error);
    }
  }

  /**
   * Handle message status update from WebSocket
   */
  private async handleMessageStatusUpdate(update: MessageStatusUpdate): Promise<void> {
    try {
      let messageUpdated = false;

      try {
        await dbOps.updateMessageStatus(update.messageId, update.status);
        messageUpdated = true;
      } catch (error) {
        console.error(`Failed to update by server ID: ${update.messageId}`, error);
      }

      // If server ID update failed, try to find and update by temp ID
      if (!messageUpdated) {
        try {
          const tempMessage = await dbOps.getMessageByTempId(update.messageId);
          if (tempMessage) {
            await dbOps.updateMessageStatus(tempMessage.id, update.status);
            messageUpdated = true;
          }
        } catch (error) {
          console.error(`Failed to update by temp ID: ${update.messageId}`, error);
        }
      }

      // Clean up send_message_request when server confirms message was processed
      // This prevents duplicate sends when coming back online
      if (update.status === 'sent' || update.status === 'delivered' || update.status === 'read') {
        try {
          await messageScheduler.cleanupProcessedMessage(update.messageId);
        } catch (_error) {
          console.error(
            `Cleanup by message ID failed, this is normal for temp IDs: ${update.messageId}`
          );
        }
      }

      if (messageUpdated) {
        broadcastChannelService.broadcastMessageStatusUpdated(update.messageId, update.status);
      }

      // Notify UI about the status update
      this.eventListeners.messageStatusUpdated?.(update.messageId, update.status);
    } catch (error) {
      console.error('Error handling message status update:', error);
    }
  }

  /**
   * Load conversations from local database with fallback to server
   */
  async loadConversations(userId: string): Promise<ChatRoom[]> {
    try {
      const localConversations = await dbOps.getUserConversations(userId);

      if (localConversations.length > 0) {
        // Convert local conversations to ChatRoom format
        const chatRooms: ChatRoom[] = localConversations.map((conversation) => ({
          id: conversation.id,
          name: conversation.name ?? null,
          createdBy: conversation.createdBy,
          participants: conversation.participants,
          lastMessage: conversation.lastMessage,
          createdAt: conversation.createdAt.toISOString(),
          updatedAt: conversation.updatedAt.toISOString(),
        }));

        return chatRooms;
      }

      // If no local data, fetch from server using HTTP API
      try {
        const serverData = await conversationApi.getConversations();

        // Store in local database
        for (const conversation of serverData.data) {
          await dbOps.upsertConversation({
            id: conversation.id,
            name: conversation.name || undefined,
            createdBy: conversation.createdBy,
            createdAt: new Date(conversation.createdAt),
            updatedAt: new Date(conversation.updatedAt),
          });

          // Store participants
          for (const participant of conversation.participants) {
            try {
              await dbOps.upsertUser({
                id: participant.id,
                name: participant.name,
                email: participant.email,
                profilePictureUrl: participant.profilePictureUrl || undefined,
              });

              await dbOps.addConversationParticipant({
                conversationId: conversation.id,
                userId: participant.id,
              });
            } catch (error) {
              console.error(
                `Failed to process participant ${participant.id} for conversation ${conversation.id}:`,
                error
              );
            }
          }

          // Store last message if it exists
          if (conversation.lastMessage) {
            try {
              // Store the last message
              await dbOps.upsertMessage({
                id: conversation.lastMessage.id,
                content: conversation.lastMessage.content,
                status: conversation.lastMessage.status,
                senderId: conversation.lastMessage.senderId,
                conversationId: conversation.lastMessage.conversationId,
                tempId: conversation.lastMessage.tempId,
                createdAt: conversation.lastMessage.createdAt,
                updatedAt: conversation.lastMessage.updatedAt,
              });
              this.webSocketService?.markMessageDelivered(
                conversation.lastMessage.id,
                conversation.id
              );
            } catch (error) {
              console.error(
                `Failed to store last message for conversation ${conversation.id}:`,
                error
              );
            }
          }
        }
        return serverData.data;
      } catch (apiError) {
        console.error('Failed to fetch from server:', apiError);
        return [];
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
      throw error;
    }
  }

  /**
   * Initialize sequence counter for a user in a conversation based on existing messages
   */
  private async initializeSequenceCounter(
    conversationId: string,
    userId: string,
    messages: UIMessage[]
  ): Promise<void> {
    try {
      const existingCounter = await db.sequence_counters.get([conversationId, userId]);
      if (existingCounter) return;

      const userMessages = messages.filter(
        (m) => m.senderId === userId && m.sequenceNumber != null
      );

      if (!userMessages.length) return;

      const maxSequence = Math.max(...userMessages.map((m) => m.sequenceNumber!));

      await db.sequence_counters.put({
        conversationId: conversationId,
        userId: userId,
        nextSequence: maxSequence + 1,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Failed to initialize sequence counter:', error);
    }
  }

  /**
   * Load messages for a specific conversation from local database with fallback to server
   */
  async loadMessages(
    conversationId: string,
    limit = 50
  ): Promise<{ messages: UIMessage[]; hasMore: boolean }> {
    try {
      // Get messages from local database
      const localMessages = await dbOps.getConversationMessages(conversationId, { limit });

      if (localMessages.length > 0) {
        // Check if we have complete conversation data by looking for a flag
        // If we have more than 1 message, it means we've previously loaded the full conversation
        // If we have exactly 1 message, it might just be the last_message from loadConversations
        const hasCompleteConversation = localMessages.length > 1;

        if (hasCompleteConversation) {
          // Convert database messages to UI messages by adding sender info
          const uiMessages = [];
          for (const message of localMessages) {
            const sender = await dbOps.getUser(message.senderId);
            if (sender) {
              uiMessages.push({
                ...message,
                sender,
                created_at: ensureDate(message.createdAt),
                updated_at: ensureDate(message.updatedAt),
              });
            }
          }

          let hasMore = false;
          const paginationMeta = await dbOps.getPaginationMetadata(conversationId);

          if (paginationMeta && uiMessages.length > 0) {
            hasMore = paginationMeta.hasMore;
          }

          return { messages: uiMessages, hasMore };
        }
      }

      // If no local data or incomplete data, fetch from server using HTTP API
      try {
        const serverData = await conversationApi.getMessages(conversationId, { limit });

        for (const message of serverData.messages) {
          await dbOps.upsertMessage({
            id: message.id,
            content: message.content,
            status: message.status,
            senderId: message.senderId,
            conversationId: message.conversationId,
            tempId: message.tempId,
            createdAt: message.createdAt,
            updatedAt: message.updatedAt,
          });
        }

        // Store pagination metadata
        if (serverData.messages.length > 0) {
          const oldestMessageId = serverData.messages[0].id;
          await dbOps.upsertPaginationMetadata(conversationId, {
            hasMore: serverData.hasMore,
            nextCursor: serverData.nextCursor,
            lastMessageId: oldestMessageId,
          });
        }

        // Initialize sequence counters for current user based on loaded messages
        if (this.currentUserId && serverData.messages.length > 0) {
          await this.initializeSequenceCounter(
            conversationId,
            this.currentUserId,
            serverData.messages
          );
        }

        return {
          messages: serverData.messages.map((message) => ({
            ...message,
            created_at: ensureDate(message.createdAt),
            updated_at: ensureDate(message.updatedAt),
          })),
          hasMore: serverData.hasMore,
        };
      } catch (apiError) {
        console.error('Failed to fetch messages from server:', apiError);
        return { messages: [], hasMore: false };
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
      throw error;
    }
  }

  /**
   * Load more (older) messages for pagination
   */
  async loadMoreMessages(
    conversationId: string,
    oldestMessageId: string,
    limit = 50
  ): Promise<{ messages: UIMessage[]; hasMore: boolean }> {
    try {
      // First, try to load from local IndexedDB
      const localMessages = await dbOps.getConversationMessages(conversationId, {
        limit,
        nextCursor: oldestMessageId,
      });

      // If we have messages locally AND we got the full limit, use local data
      // Otherwise, fetch from server (local cache might be incomplete)
      if (localMessages.length === limit) {
        // Convert to UI messages
        const uiMessages = [];
        for (const message of localMessages) {
          const sender = await dbOps.getUser(message.senderId);
          if (sender) {
            uiMessages.push({
              ...message,
              sender,
              created_at: ensureDate(message.createdAt),
              updated_at: ensureDate(message.updatedAt),
            });
          }
        }

        const paginationMetadata = await dbOps.getPaginationMetadata(conversationId);

        return { messages: uiMessages, hasMore: paginationMetadata?.hasMore ?? false };
      }

      try {
        const serverData = await conversationApi.getMessages(conversationId, {
          limit,
          nextCursor: oldestMessageId,
        });

        // Store messages locally for future offline access
        for (const message of serverData.messages) {
          await dbOps.upsertMessage({
            id: message.id,
            content: message.content,
            status: message.status,
            senderId: message.senderId,
            conversationId: message.conversationId,
            tempId: message.tempId,
            createdAt: message.createdAt,
            updatedAt: message.updatedAt,
          });
        }

        // Update pagination metadata with server response
        if (serverData.messages.length > 0) {
          const oldestNewMessageId = serverData.messages[0].id;
          await dbOps.upsertPaginationMetadata(conversationId, {
            hasMore: serverData.hasMore,
            nextCursor: serverData.nextCursor,
            lastMessageId: oldestNewMessageId,
          });
        }

        // Note: Sequence counter initialization is NOT needed here for pagination
        // It's only initialized once during initial message load in loadMessages()

        // Broadcast pagination completion to other tabs
        broadcastChannelService.broadcastPaginationCompleted(
          conversationId,
          serverData.messages.length,
          serverData.hasMore
        );

        return {
          messages: serverData.messages.map((message) => ({
            ...message,
            created_at: ensureDate(message.createdAt),
            updated_at: ensureDate(message.updatedAt),
          })),
          hasMore: serverData.hasMore,
        };
      } catch (apiError) {
        console.error('Failed to fetch more messages from server:', apiError);

        // Fallback to local messages if we have any, even if incomplete
        if (localMessages.length > 0) {
          const uiMessages = [];
          for (const message of localMessages) {
            const sender = await dbOps.getUser(message.senderId);
            if (sender) {
              uiMessages.push({
                ...message,
                sender,
                created_at: ensureDate(message.createdAt),
                updated_at: ensureDate(message.updatedAt),
              });
            }
          }
          return { messages: uiMessages, hasMore: false };
        }

        return { messages: [], hasMore: false };
      }
    } catch (error) {
      console.error('Failed to load more messages:', error);
      throw error;
    }
  }

  /**
   * Send a message through the scheduler
   */
  async sendMessage(
    conversationId: string,
    content: string,
    tempId: string,
    userId: string
  ): Promise<void> {
    try {
      // Get next sequence number for this conversation and user
      const sequenceNumber = await getNextSequenceNumber(conversationId, userId);

      // Create optimistic message in database
      const optimisticMessage: Omit<Message, 'createdAt' | 'updatedAt'> = {
        id: tempId, // Will be replaced with server ID
        conversationId: conversationId,
        senderId: userId,
        content,
        status: 'sending',
        tempId: tempId,
        sequenceNumber: sequenceNumber,
      };

      await dbOps.upsertMessage(optimisticMessage);

      // Queue message for sending using the message ID
      await messageScheduler.queueMessage(tempId);
    } catch (error) {
      throw new Error(`Failed to send message: ${error}`);
    }
  }

  /**
   * Register event listener
   */
  on<K extends keyof SyncEvents>(event: K, listener: SyncEvents[K]): void {
    this.eventListeners[event] = listener;
  }

  /**
   * Unregister event listener
   */
  off<K extends keyof SyncEvents>(event: K): void {
    delete this.eventListeners[event];
  }

  /**
   * Get synchronization status
   */
  getSyncStatus(): {
    isInitialized: boolean;
    isConnected: boolean;
    queueStatus: Promise<{
      pending: number;
      inFlight: number;
      failed: number;
      totalRetries: number;
    }>;
  } {
    return {
      isInitialized: this.isInitialized,
      isConnected: this.webSocketService?.isConnected() ?? false,
      queueStatus: messageScheduler.getQueueStatus(),
    };
  }

  /**
   * Clear all local data (useful for logout)
   */
  async clearLocalData(): Promise<void> {
    try {
      await dbOps.clearAllData();
      await messageScheduler.clearFailedRequests();
    } catch (error) {
      throw new Error(`Failed to clear local data: ${error}`);
    }
  }
}

// Export singleton instance
export const dataSyncer = new DataSyncer();
