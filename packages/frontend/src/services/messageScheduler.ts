import { ensureDate } from '@/utils/helpers';
import type { Message, SendMessageRequest } from '../types/database';
import { dbOps } from './databaseOperations';
import type { SendMessageRequest, Message } from '../types/database';
import { ensureDate } from '@/utils/helpers';

interface SchedulerConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  processingIntervalMs: number;
  messageTimeoutMs: number;
  cleanupIntervalMs: number;
}

const DEFAULT_CONFIG: SchedulerConfig = {
  maxRetries: 5,
  baseDelayMs: 1000, // 1 second
  maxDelayMs: 30000, // 30 seconds
  processingIntervalMs: 2000, // Check queue every 2 seconds
  messageTimeoutMs: 30000, // 30 seconds timeout for message sending
  cleanupIntervalMs: 300000, // Clean up every 5 minutes
};

export class MessageScheduler {
  private config: SchedulerConfig;
  private isProcessing = false;
  private processingTimer: number | null = null;
  private cleanupTimer: number | null = null;
  private sendMessageCallback: ((request: SendMessageRequest) => Promise<Message>) | null = null;
  private errorCallback: ((error: string, tempId: string) => void) | null = null;

  constructor(config: Partial<SchedulerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Set the callback function for sending messages
   * This should be provided by the WebSocket service or API layer
   */
  setSendMessageCallback(callback: (request: SendMessageRequest) => Promise<Message>): void {
    this.sendMessageCallback = callback;
  }

  /**
   * Wraps message sending with timeout handling
   */
  private async sendMessageWithTimeout(request: SendMessageRequest): Promise<Message> {
    if (!this.sendMessageCallback) {
      throw new Error('Send message callback not set');
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Message send timeout after ${this.config.messageTimeoutMs}ms`));
      }, this.config.messageTimeoutMs);

      this.sendMessageCallback!(request)
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Start the message scheduler
   * Begins processing the queue at regular intervals
   */
  start(): void {
    if (this.processingTimer) {
      return; // Already started
    }

    this.processingTimer = setInterval(() => {
      this.processQueue().catch((error) => {
        console.error('Error processing message queue:', error);
      });
    }, this.config.processingIntervalMs);

    this.cleanupTimer = setInterval(() => {
      this.performCleanup().catch((error) => {
        console.error('Error during cleanup:', error);
      });
    }, this.config.cleanupIntervalMs);

    this.processQueue().catch((error) => {
      console.error('Error processing message queue on start:', error);
    });
  }

  /**
   * Stop the message scheduler
   */
  stop(): void {
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
      this.processingTimer = null;
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Queue a message for sending
   * Creates a send request and stores it in the database
   */
  async queueMessage(messageId: string): Promise<SendMessageRequest> {
    try {
      const request = await dbOps.createSendMessageRequest({
        message_id: messageId,
        status: 'pending',
        retry_count: 0,
      });

      // Trigger immediate processing if not already running
      if (!this.isProcessing) {
        this.processQueue().catch((error) => {
          console.error('Error processing queue after queueing message:', error);
        });
      }

      return request;
    } catch (error) {
      throw new Error(`Failed to queue message: ${error}`);
    }
  }

  /**
   * Process the message queue
   */
  private async processQueue(): Promise<void> {
    try {
      const [pendingRequests, retryRequests] = await Promise.all([
        dbOps.getPendingSendRequests(),
        this.getRetryableFailedRequests(),
      ]);

      const allRequests = [...pendingRequests, ...retryRequests];

      if (allRequests.length === 0) {
        return;
      }

      // Process all requests concurrently
      await Promise.all(allRequests.map((request) => this.processRequest(request)));
    } catch (error) {
      console.error('Error processing message queue:', error);
    }
  }

  /**
   * Get failed requests that are ready for retry based on exponential backoff
   */
  private async getRetryableFailedRequests(): Promise<SendMessageRequest[]> {
    try {
      const failedRequests = await dbOps.getSendRequestsByStatus('failed');

      const now = new Date();
      const currentTime = now.getTime();

      return failedRequests.filter((request: SendMessageRequest) => {
        if (request.retry_count >= this.config.maxRetries) {
          return false;
        }

        // Use retry_count - 1 because retry_count was already incremented when the message failed
        const expectedDelay = this.calculateRetryDelay(request.retry_count - 1);
        const lastAttemptTime = ensureDate(request.last_sent_at || request.created_at).getTime();
        const nextRetryTime = lastAttemptTime + expectedDelay;

        return currentTime >= nextRetryTime;
      });
    } catch (error) {
      console.error('Error getting retryable failed requests:', error);
      return [];
    }
  }

  /**
   * Calculate retry delay using exponential backoff
   */
  private calculateRetryDelay(failCount: number): number {
    const delay =
      failCount === 0 ? this.config.baseDelayMs : this.config.baseDelayMs * 2 ** failCount;
    return Math.min(delay, this.config.maxDelayMs);
  }

  /**
   * Process a single send request
   */
  private async processRequest(request: SendMessageRequest): Promise<void> {
    try {
      // Mark as in_flight
      await dbOps.updateSendRequestStatus(request.id, 'in_flight');

      // Attempt to send the message with timeout
      const sentMessage = await this.sendMessageWithTimeout(request);

      // Update the message in the database with server response
      await dbOps.upsertMessage(sentMessage);

      // Mark request as successful and remove from queue
      await dbOps.deleteSendRequest(request.id);

      console.log(`Message sent successfully: ${request.message_id}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isTimeoutError = errorMessage.includes('timeout');
      const isNetworkError =
        errorMessage.includes('network') || errorMessage.includes('connection');

      // Mark as failed and increment retry count
      await dbOps.updateSendRequestStatus(request.id, 'failed', errorMessage);

      // Update message status to failed if max retries exceeded
      const updatedRequest = await dbOps.db.send_message_requests.get(request.id);
      if (updatedRequest && updatedRequest.retry_count >= this.config.maxRetries) {
        await dbOps.updateMessageStatus(request.message_id, 'failed');

        // Notify user of permanent failure
        if (this.errorCallback) {
          let userMessage = 'Message failed to send';
          if (isTimeoutError) {
            userMessage = 'Message send timeout - please check your connection';
          } else if (isNetworkError) {
            userMessage = 'Network error - message could not be delivered';
          }
          this.errorCallback(userMessage, request.message_id);
        }
      } else {
        console.warn(
          `Message send failed, will retry (${updatedRequest?.retry_count || 0}/${this.config.maxRetries}): ${request.message_id}`,
          { error: errorMessage, isTimeout: isTimeoutError, isNetwork: isNetworkError }
        );
      }
    }
  }

  /**
   * Perform periodic cleanup of failed messages and queue maintenance
   */
  private async performCleanup(): Promise<void> {
    try {
      // Clean up failed temporary messages older than 1 hour
      await dbOps.cleanupFailedTemporaryMessages(60 * 60 * 1000);

      // Clean up orphaned temporary messages
      await dbOps.cleanupOrphanedTemporaryMessages();

      // Get stats for monitoring
      const stats = await dbOps.getTemporaryMessageStats();
      const queueStatus = await this.getQueueStatus();

      console.log('Cleanup completed', {
        temporaryMessages: stats,
        queueStatus,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  /**
   * Get queue status for monitoring
   */
  async getQueueStatus(): Promise<{
    pending: number;
    inFlight: number;
    failed: number;
    totalRetries: number;
  }> {
    try {
      const [pending, inFlight, failed] = await Promise.all([
        dbOps.getSendRequestsByStatus('pending').then((reqs: SendMessageRequest[]) => reqs.length),
        dbOps
          .getSendRequestsByStatus('in_flight')
          .then((reqs: SendMessageRequest[]) => reqs.length),
        dbOps.getSendRequestsByStatus('failed').then((reqs: SendMessageRequest[]) => reqs.length),
      ]);

      const failedRequests = await dbOps.getSendRequestsByStatus('failed');

      const totalRetries = failedRequests.reduce(
        (sum: number, req: SendMessageRequest) => sum + req.retry_count,
        0
      );

      return {
        pending,
        inFlight,
        failed,
        totalRetries,
      };
    } catch (error) {
      console.error('Error getting queue status:', error);
      return { pending: 0, inFlight: 0, failed: 0, totalRetries: 0 };
    }
  }

  /**
   * Clear all failed requests (useful for cleanup)
   */
  async clearFailedRequests(): Promise<void> {
    try {
      const failedRequests = await dbOps.getSendRequestsByStatus('failed');

      for (const request of failedRequests) {
        await dbOps.deleteSendRequest(request.id);
      }
    } catch (error) {
      console.error('Error clearing failed requests:', error);
    }
  }

  /**
   * Clean up send_message_request when server confirms message was processed
   * This prevents duplicate sends when coming back online
   */
  async cleanupProcessedMessage(messageId: string): Promise<void> {
    try {
      // Find send_message_request by message_id
      const allRequests = await dbOps.db.send_message_requests.toArray();
      const request = allRequests.find((req) => req.message_id === messageId);

      if (request) {
        await dbOps.deleteSendRequest(request.id);
        console.log(`Cleaned up send request for processed message: ${messageId}`);
      }
    } catch (error) {
      console.error('Error cleaning up processed message:', error);
    }
  }

  /**
   * Get configuration
   */
  getConfig(): SchedulerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<SchedulerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// Export singleton instance
export const messageScheduler = new MessageScheduler();
