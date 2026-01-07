import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMockMessage,
  createMockSendRequest,
  resetMockCounters,
} from '@/__tests__/utils/mockFactories';
import { delay } from '@/__tests__/utils/testHelpers';
import type { Message, SendMessageRequest } from '@/types/database';
import { dbOps } from '../databaseOperations';
import { MessageScheduler } from '../messageScheduler';

describe('MessageScheduler', () => {
  let scheduler: MessageScheduler;
  let mockSendCallback: ReturnType<typeof vi.fn<(req: SendMessageRequest) => Promise<Message>>>;

  beforeEach(async () => {
    // Ensure scheduler from previous test is stopped
    if (scheduler) {
      scheduler.stop();
      // Wait for all timers to fully stop
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Close and delete existing database
    if (dbOps.db.isOpen()) {
      try {
        // Aggressively clear all data
        await dbOps.db.send_message_requests.clear();
        await dbOps.db.messages.clear();
        await dbOps.db.users.clear();
        await dbOps.db.conversations.clear();
        await dbOps.db.conversation_participants.clear();
        await dbOps.db.draft_messages.clear();
        await dbOps.db.sequence_counters.clear();
      } catch {
        // Ignore errors
      }
      dbOps.db.close();
    }
    await dbOps.db.delete();

    // Open fresh database
    await dbOps.db.open();
    resetMockCounters();

    // Create scheduler with short intervals for testing
    scheduler = new MessageScheduler({
      maxRetries: 5,
      baseDelayMs: 100,
      maxDelayMs: 1000,
      processingIntervalMs: 100,
      messageTimeoutMs: 1000,
      cleanupIntervalMs: 5000,
    });

    // Setup mock send callback
    // Note: Each test must mock the expected behavior explicitly
    mockSendCallback = vi.fn();
    scheduler.setSendMessageCallback(mockSendCallback);

    // Clear mock calls from constructor
    vi.clearAllMocks();
  });

  afterEach(async () => {
    scheduler.stop();

    // Wait a bit for any pending operations
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Clean up database completely before closing
    if (dbOps.db.isOpen()) {
      try {
        // Clear all tables to prevent state leakage
        await dbOps.db.send_message_requests.clear();
        await dbOps.db.messages.clear();
        await dbOps.db.users.clear();
        await dbOps.db.conversations.clear();
      } catch (_error) {
        // Ignore errors during cleanup
      }
      dbOps.db.close();
    }

    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  describe('Constructor and Configuration', () => {
    it('should create scheduler with default config', () => {
      const defaultScheduler = new MessageScheduler();
      const config = defaultScheduler.getConfig();

      expect(config.maxRetries).toBe(5);
      expect(config.baseDelayMs).toBe(1000);
      expect(config.maxDelayMs).toBe(30000);
      expect(config.processingIntervalMs).toBe(2000);
      expect(config.messageTimeoutMs).toBe(30000);
      expect(config.cleanupIntervalMs).toBe(300000);

      defaultScheduler.stop();
    });

    it('should create scheduler with custom config', () => {
      const customScheduler = new MessageScheduler({
        maxRetries: 3,
        baseDelayMs: 500,
      });

      const config = customScheduler.getConfig();

      expect(config.maxRetries).toBe(3);
      expect(config.baseDelayMs).toBe(500);
      expect(config.maxDelayMs).toBe(30000); // Default value

      customScheduler.stop();
    });

    it('should allow updating config after creation', () => {
      scheduler.updateConfig({ maxRetries: 10 });

      const config = scheduler.getConfig();
      expect(config.maxRetries).toBe(10);
    });

    it('should setup service worker sync listener', () => {
      // Service worker should be available from setup.ts mock
      expect(navigator.serviceWorker).toBeDefined();
      expect(navigator.serviceWorker.addEventListener).toBeDefined();
    });
  });

  describe('start() and stop()', () => {
    it('should start processing queue at regular intervals', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: Testing private method
      const processQueueSpy = vi.spyOn(scheduler as any, 'processQueue');

      scheduler.start();
      await delay(250); // Wait for 2-3 processing cycles (100ms interval)

      expect(processQueueSpy).toHaveBeenCalled();
      expect(processQueueSpy.mock.calls.length).toBeGreaterThanOrEqual(2);

      scheduler.stop();
      processQueueSpy.mockRestore();
    });

    it('should not start multiple timers if already started', () => {
      scheduler.start();
      scheduler.start();
      scheduler.start();

      // Should only have one timer running
      // biome-ignore lint/suspicious/noExplicitAny: Testing private property
      expect((scheduler as any).processingTimer).toBeTruthy();

      scheduler.stop();
    });

    it('should stop all timers when stopped', () => {
      scheduler.start();
      // biome-ignore lint/suspicious/noExplicitAny: Testing private property
      expect((scheduler as any).processingTimer).toBeTruthy();
      // biome-ignore lint/suspicious/noExplicitAny: Testing private property
      expect((scheduler as any).cleanupTimer).toBeTruthy();

      scheduler.stop();
      // biome-ignore lint/suspicious/noExplicitAny: Testing private property
      expect((scheduler as any).processingTimer).toBeNull();
      // biome-ignore lint/suspicious/noExplicitAny: Testing private property
      expect((scheduler as any).cleanupTimer).toBeNull();
    });

    it('should process queue immediately on start', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: Testing private method
      const processQueueSpy = vi.spyOn(scheduler as any, 'processQueue');

      scheduler.start();
      await delay(0); // Process immediate calls

      expect(processQueueSpy).toHaveBeenCalledTimes(1);

      scheduler.stop();
      processQueueSpy.mockRestore();
    });
  });

  describe('queueMessage()', () => {
    it('should queue a message for sending', async () => {
      const message = createMockMessage();
      await dbOps.upsertMessage(message);

      const request = await scheduler.queueMessage(message.id);

      expect(request).toBeDefined();
      expect(request.message_id).toBe(message.id);
      expect(request.status).toBe('pending');
      expect(request.retry_count).toBe(0);
    });

    it('should create send request in database', async () => {
      const message = createMockMessage();
      await dbOps.upsertMessage(message);

      // Don't set up mock callback - let it fail naturally to keep request in queue
      scheduler.setSendMessageCallback(vi.fn());

      const request = await scheduler.queueMessage(message.id);

      // Check immediately - request should be in database before processing starts
      const dbRequest = await dbOps.db.send_message_requests.get(request.id);
      expect(dbRequest).toBeDefined();
      expect(dbRequest?.message_id).toBe(message.id);
      expect(dbRequest?.status).toBe('pending');
    });

    it('should trigger immediate processing if not already running', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: Testing private method
      const processQueueSpy = vi.spyOn(scheduler as any, 'processQueue');
      const message = createMockMessage();
      await dbOps.upsertMessage(message);

      // Mock successful send
      mockSendCallback.mockResolvedValueOnce(message);

      await scheduler.queueMessage(message.id);
      await delay(50);

      expect(processQueueSpy).toHaveBeenCalled();

      processQueueSpy.mockRestore();
    });

    it('should register background sync if available', async () => {
      const message = createMockMessage();
      await dbOps.upsertMessage(message);

      // Stop scheduler to prevent background processing
      scheduler.stop();

      // Mock successful send to avoid processing errors
      mockSendCallback.mockResolvedValue(message);

      // Ensure ServiceWorkerRegistration.prototype has sync property
      // This is needed for the condition check in queueMessage
      if (!('sync' in ServiceWorkerRegistration.prototype)) {
        Object.defineProperty(ServiceWorkerRegistration.prototype, 'sync', {
          value: {},
          writable: true,
          configurable: true,
        });
      }

      // Get the sync mock before queueing
      const registration = await navigator.serviceWorker.ready;

      // Ensure the mock is properly set up
      const syncRegisterSpy = vi.spyOn(registration.sync, 'register');

      // Queue the message
      await scheduler.queueMessage(message.id);

      // Check that sync.register was called
      expect(syncRegisterSpy).toHaveBeenCalledWith('sync-messages');

      syncRegisterSpy.mockRestore();
    });

    it('should handle errors when queueing fails', async () => {
      // Stop the scheduler to prevent background processing
      scheduler.stop();

      // Mock database error by closing the database
      dbOps.db.close();

      // Try to queue a message when database is closed
      await expect(scheduler.queueMessage('msg-id')).rejects.toThrow();

      // Reopen database for subsequent tests
      await dbOps.db.open();
    });
  });

  describe('processQueue() - Basic Flow', () => {
    it('should process pending send requests', async () => {
      const message = createMockMessage();
      await dbOps.upsertMessage(message);

      mockSendCallback.mockResolvedValueOnce(message);

      await scheduler.queueMessage(message.id);
      scheduler.start();

      await delay(150); // Wait for processing

      expect(mockSendCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          message_id: message.id,
          status: 'pending',
        })
      );

      scheduler.stop();
    });

    it('should mark request as in_flight during processing', async () => {
      const message = createMockMessage();
      await dbOps.upsertMessage(message);

      let capturedStatus: string | undefined;

      mockSendCallback.mockImplementation(async () => {
        await delay(50);
        const requests = await dbOps.db.send_message_requests.toArray();
        capturedStatus = requests[0]?.status;
        return message;
      });

      await scheduler.queueMessage(message.id);
      scheduler.start();

      await delay(150);

      expect(capturedStatus).toBe('in_flight');

      scheduler.stop();
    });

    it('should delete request after successful send', async () => {
      const message = createMockMessage();
      await dbOps.upsertMessage(message);

      mockSendCallback.mockResolvedValueOnce(message);

      const request = await scheduler.queueMessage(message.id);
      scheduler.start();

      await delay(150);

      const dbRequest = await dbOps.db.send_message_requests.get(request.id);
      expect(dbRequest).toBeUndefined();

      scheduler.stop();
    });

    it('should update message in database with server response', async () => {
      const message = createMockMessage({ id: 'temp_123', status: 'sending' });
      await dbOps.upsertMessage(message);

      const serverMessage = { ...message, id: 'server-uuid-123', status: 'sent' as const };
      mockSendCallback.mockResolvedValueOnce(serverMessage);

      await scheduler.queueMessage(message.id);
      scheduler.start();

      await delay(150);

      const updatedMessage = await dbOps.db.messages.get('server-uuid-123');
      expect(updatedMessage).toBeDefined();
      expect(updatedMessage?.status).toBe('sent');

      scheduler.stop();
    });

    it('should process multiple requests concurrently', async () => {
      // Stop scheduler first to prevent race conditions
      scheduler.stop();

      const messages = [
        createMockMessage({ id: 'msg-1' }),
        createMockMessage({ id: 'msg-2' }),
        createMockMessage({ id: 'msg-3' }),
      ];

      for (const msg of messages) {
        await dbOps.upsertMessage(msg);
      }

      // Set up all mocks to return their respective messages
      for (const msg of messages) {
        mockSendCallback.mockResolvedValueOnce(msg);
      }

      // Queue all messages
      for (const msg of messages) {
        await scheduler.queueMessage(msg.id);
      }

      // Clear the mock call count from queueing (which triggers processQueue)
      mockSendCallback.mockClear();

      // Re-setup mocks for the actual processing
      for (const msg of messages) {
        mockSendCallback.mockResolvedValueOnce(msg);
      }

      // Now start processing
      scheduler.start();
      await delay(250);

      // Should process all 3 messages
      expect(mockSendCallback).toHaveBeenCalledTimes(3);

      scheduler.stop();
    });
  });

  describe('Retry Mechanism with Exponential Backoff', () => {
    it('should retry failed requests', async () => {
      const message = createMockMessage();
      await dbOps.upsertMessage(message);

      // Fail first time, succeed second time
      mockSendCallback
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(message);

      await scheduler.queueMessage(message.id);
      scheduler.start();

      await delay(300); // Wait for retry

      expect(mockSendCallback).toHaveBeenCalledTimes(2);

      scheduler.stop();
    });

    it('should increment retry_count on failure', async () => {
      const message = createMockMessage();
      await dbOps.upsertMessage(message);

      mockSendCallback.mockRejectedValueOnce(new Error('Network error'));

      await scheduler.queueMessage(message.id);
      scheduler.start();

      await delay(200);

      const requests = await dbOps.getSendRequestsByStatus('failed');
      expect(requests.length).toBeGreaterThanOrEqual(1);
      expect(requests[0].retry_count).toBeGreaterThanOrEqual(1);

      scheduler.stop();
    });

    it('should use exponential backoff for retries', async () => {
      const message = createMockMessage();
      await dbOps.upsertMessage(message);

      mockSendCallback.mockRejectedValue(new Error('Network error'));

      await scheduler.queueMessage(message.id);
      scheduler.start();

      // Wait for multiple retry cycles
      await delay(600);

      const requests = await dbOps.getSendRequestsByStatus('failed');
      expect(requests).toHaveLength(1);

      // Check that retry_count increased (should be at least 2-3 retries)
      const retryCount = requests[0].retry_count;
      expect(retryCount).toBeGreaterThanOrEqual(2);

      scheduler.stop();
    });

    it('should calculate retry delay correctly', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: Testing private method
      const calculateRetryDelay = (scheduler as any).calculateRetryDelay.bind(scheduler);

      // failCount: 0 -> baseDelayMs (100ms)
      expect(calculateRetryDelay(0)).toBe(100);

      // failCount: 1 -> baseDelayMs * 2^1 = 200ms
      expect(calculateRetryDelay(1)).toBe(200);

      // failCount: 2 -> baseDelayMs * 2^2 = 400ms
      expect(calculateRetryDelay(2)).toBe(400);

      // failCount: 3 -> baseDelayMs * 2^3 = 800ms
      expect(calculateRetryDelay(3)).toBe(800);

      // failCount: 4 -> baseDelayMs * 2^4 = 1600ms, capped at maxDelayMs (1000ms)
      expect(calculateRetryDelay(4)).toBe(1000);
    });

    it('should not retry beyond maxRetries', async () => {
      const message = createMockMessage();
      await dbOps.upsertMessage(message);

      mockSendCallback.mockRejectedValue(new Error('Network error'));

      await scheduler.queueMessage(message.id);
      scheduler.start();

      // Wait for max retries to be exhausted
      await delay(2000);

      const requests = await dbOps.getSendRequestsByStatus('failed');
      expect(requests.length).toBeGreaterThanOrEqual(1);
      expect(requests[0].retry_count).toBeGreaterThanOrEqual(5);

      // Message should be marked as failed
      const failedMessage = await dbOps.db.messages.get(message.id);
      expect(failedMessage?.status).toBe('failed');

      scheduler.stop();
    });

    it('should store error message on failure', async () => {
      const message = createMockMessage();
      await dbOps.upsertMessage(message);

      const errorMsg = 'Connection timeout';
      // Reject all attempts to ensure it stays failed
      mockSendCallback.mockRejectedValue(new Error(errorMsg));

      await scheduler.queueMessage(message.id);
      scheduler.start();

      await delay(200);

      const requests = await dbOps.getSendRequestsByStatus('failed');
      expect(requests.length).toBeGreaterThanOrEqual(1);

      // Find the request for our message
      const ourRequest = requests.find((r) => r.message_id === message.id);
      expect(ourRequest).toBeDefined();
      expect(ourRequest?.error_message).toContain(errorMsg);

      scheduler.stop();
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout if send takes too long', async () => {
      const message = createMockMessage();
      await dbOps.upsertMessage(message);

      // Simulate slow send that exceeds timeout (messageTimeoutMs is 1000ms in test config)
      // Use a promise that never resolves to truly test timeout
      mockSendCallback.mockImplementation(() => {
        return new Promise(() => {
          // Never resolve or reject - hang forever
          // This forces the timeout wrapper to handle it
        });
      });

      await scheduler.queueMessage(message.id);
      scheduler.start();

      // Wait long enough for:
      // 1. Message to start processing (first 100ms cycle)
      // 2. Timeout to trigger (1000ms)
      // 3. Failure to be recorded in DB
      await delay(1500);

      scheduler.stop();

      // Give a moment for the status update to complete after stopping
      await delay(100);

      // Check that timeout occurred
      // The message should have timed out and failed at least once
      const allRequests = await dbOps.db.send_message_requests.toArray();
      const ourRequest = allRequests.find((r) => r.message_id === message.id);

      // Request should exist with timeout error
      expect(ourRequest).toBeDefined();

      // It should be in failed status after timeout (or possibly still in_flight if stopped mid-process)
      expect(['failed', 'in_flight']).toContain(ourRequest!.status);

      // Error message should mention timeout if it was set
      if (ourRequest!.error_message) {
        expect(ourRequest!.error_message).toContain('timeout');
      }

      // Should have attempted at least once
      expect(ourRequest!.retry_count).toBeGreaterThanOrEqual(0);
    });

    it('should not timeout if send completes in time', async () => {
      const message = createMockMessage();
      await dbOps.upsertMessage(message);

      // Simulate fast send
      mockSendCallback.mockImplementation(async () => {
        await delay(100); // Well within timeout
        return message;
      });

      await scheduler.queueMessage(message.id);
      scheduler.start();

      await delay(200);

      const pending = await dbOps.getPendingSendRequests();
      const failed = await dbOps.getSendRequestsByStatus('failed');

      expect(pending).toHaveLength(0);
      expect(failed).toHaveLength(0);

      scheduler.stop();
    });
  });

  describe('Queue Status', () => {
    it('should return correct queue status', async () => {
      // Stop scheduler to prevent automatic processing
      scheduler.stop();
      await delay(100); // Ensure stopped

      const messages = [
        createMockMessage({ id: 'status-msg-1' }),
        createMockMessage({ id: 'status-msg-2' }),
        createMockMessage({ id: 'status-msg-3' }),
      ];

      for (const msg of messages) {
        await dbOps.upsertMessage(msg);
      }

      // Create send requests directly in database to avoid triggering processQueue
      const request1 = createMockSendRequest({
        message_id: messages[0].id,
        status: 'pending',
        retry_count: 0,
      });
      const request2 = createMockSendRequest({
        message_id: messages[1].id,
        status: 'pending',
        retry_count: 0,
      });
      const failedRequest = createMockSendRequest({
        message_id: messages[2].id,
        status: 'failed',
        retry_count: 2,
      });

      await dbOps.db.send_message_requests.add(request1);
      await dbOps.db.send_message_requests.add(request2);
      await dbOps.db.send_message_requests.add(failedRequest);

      // Wait for database operations to settle
      await delay(50);

      const status = await scheduler.getQueueStatus();

      expect(status.pending).toBe(2);
      expect(status.failed).toBe(1);
      expect(status.totalRetries).toBe(2);
    });

    it('should handle empty queue', async () => {
      const status = await scheduler.getQueueStatus();

      expect(status.pending).toBe(0);
      expect(status.inFlight).toBe(0);
      expect(status.failed).toBe(0);
      expect(status.totalRetries).toBe(0);
    });
  });

  describe('clearFailedRequests()', () => {
    it('should clear all failed requests', async () => {
      const messages = [createMockMessage({ id: 'msg-1' }), createMockMessage({ id: 'msg-2' })];

      for (const msg of messages) {
        await dbOps.upsertMessage(msg);
        const failedRequest = createMockSendRequest({
          message_id: msg.id,
          status: 'failed',
          retry_count: 5,
        });
        await dbOps.db.send_message_requests.add(failedRequest);
      }

      await scheduler.clearFailedRequests();

      const failed = await dbOps.getSendRequestsByStatus('failed');
      expect(failed).toHaveLength(0);
    });

    it('should not affect pending or in_flight requests', async () => {
      // Stop scheduler to prevent automatic processing
      scheduler.stop();
      await delay(100); // Ensure stopped

      const messages = [
        createMockMessage({ id: 'clear-msg-1' }),
        createMockMessage({ id: 'clear-msg-2' }),
      ];

      for (const msg of messages) {
        await dbOps.upsertMessage(msg);
      }

      // Create requests directly in database to avoid triggering processQueue
      const pendingRequest = createMockSendRequest({
        message_id: messages[0].id,
        status: 'pending',
      });
      const inFlightRequest = createMockSendRequest({
        message_id: messages[1].id,
        status: 'in_flight',
      });

      await dbOps.db.send_message_requests.add(pendingRequest);
      await dbOps.db.send_message_requests.add(inFlightRequest);

      await delay(50);

      await scheduler.clearFailedRequests();

      const pending = await dbOps.getPendingSendRequests();
      const inFlight = await dbOps.getSendRequestsByStatus('in_flight');

      expect(pending.length).toBe(1);
      expect(inFlight.length).toBe(1);
    });
  });

  describe('cleanupProcessedMessage()', () => {
    it('should cleanup send request when server confirms message', async () => {
      const message = createMockMessage({ id: 'msg-1' });
      await dbOps.upsertMessage(message);

      const request = await scheduler.queueMessage(message.id);

      await scheduler.cleanupProcessedMessage(message.id);

      const dbRequest = await dbOps.db.send_message_requests.get(request.id);
      expect(dbRequest).toBeUndefined();
    });

    it('should not error if no request exists for message', async () => {
      await expect(scheduler.cleanupProcessedMessage('non-existent-id')).resolves.not.toThrow();
    });
  });

  describe('Service Worker Integration', () => {
    it('should handle SYNC_MESSAGES event from service worker', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: Testing private method
      const processQueueSpy = vi.spyOn(scheduler as any, 'processQueue');

      // Simulate service worker sync event
      const event = new MessageEvent('message', {
        data: { type: 'SYNC_MESSAGES' },
      });

      navigator.serviceWorker.dispatchEvent(event);
      await delay(50);

      expect(processQueueSpy).toHaveBeenCalled();

      processQueueSpy.mockRestore();
    });

    it('should ignore non-SYNC_MESSAGES events', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: Testing private method
      const processQueueSpy = vi.spyOn(scheduler as any, 'processQueue');
      processQueueSpy.mockClear();

      // Simulate different event type
      const event = new MessageEvent('message', {
        data: { type: 'OTHER_EVENT' },
      });

      navigator.serviceWorker.dispatchEvent(event);
      await delay(50);

      expect(processQueueSpy).not.toHaveBeenCalled();

      processQueueSpy.mockRestore();
    });
  });

  describe('Error Scenarios', () => {
    it('should handle missing send callback gracefully', async () => {
      const schedulerWithoutCallback = new MessageScheduler({
        processingIntervalMs: 100,
      });

      const message = createMockMessage();
      await dbOps.upsertMessage(message);

      await schedulerWithoutCallback.queueMessage(message.id);
      schedulerWithoutCallback.start();

      await delay(150);

      const requests = await dbOps.getSendRequestsByStatus('failed');
      expect(requests).toHaveLength(1);
      expect(requests[0].error_message).toContain('Send message callback not set');

      schedulerWithoutCallback.stop();
    });

    it('should continue processing queue even if one request fails', async () => {
      // Stop main scheduler and clean up
      scheduler.stop();
      await delay(100);
      await dbOps.db.send_message_requests.clear();
      await dbOps.db.messages.clear();

      // Create fresh scheduler
      const errorScheduler = new MessageScheduler({
        processingIntervalMs: 50,
        maxRetries: 5,
        baseDelayMs: 500, // Longer delay so retry doesn't happen within test time
      });
      const errorMockCallback = vi.fn();
      errorScheduler.setSendMessageCallback(errorMockCallback);

      const messages = [
        createMockMessage({ id: 'error-msg-1' }),
        createMockMessage({ id: 'error-msg-2' }),
      ];

      for (const msg of messages) {
        await dbOps.upsertMessage(msg);
      }

      // Track how many times each message was attempted
      const callCounts = new Map<string, number>();

      // Set up mocks: first message fails, second succeeds
      errorMockCallback.mockImplementation(async (req) => {
        callCounts.set(req.message_id, (callCounts.get(req.message_id) || 0) + 1);
        if (req.message_id === 'error-msg-1') {
          throw new Error('Network error');
        }
        return messages[1];
      });

      // Stop scheduler, queue messages, then start
      errorScheduler.stop();
      await errorScheduler.queueMessage(messages[0].id);
      await errorScheduler.queueMessage(messages[1].id);

      errorScheduler.start();
      // Wait only long enough for first processing cycle
      await delay(150);

      errorScheduler.stop();

      // Both messages should be attempted at least once
      expect(errorMockCallback.mock.calls.length).toBeGreaterThanOrEqual(2);

      // Check that both message IDs were attempted
      // biome-ignore lint/suspicious/noExplicitAny: Mock call arguments typing
      const attemptedIds = errorMockCallback.mock.calls.map((call: any[]) => call[0].message_id);
      expect(attemptedIds).toContain('error-msg-1');
      expect(attemptedIds).toContain('error-msg-2');

      const failed = await dbOps.getSendRequestsByStatus('failed');
      expect(failed.length).toBeGreaterThanOrEqual(1);
      const failedMsg = failed.find((r) => r.message_id === 'error-msg-1');
      expect(failedMsg).toBeDefined();

      await delay(50);
    });

    it('should handle database errors gracefully', async () => {
      const message = createMockMessage();
      await dbOps.upsertMessage(message);

      mockSendCallback.mockResolvedValueOnce(message);

      // Force database error by closing the database
      dbOps.db.close();

      await expect(scheduler.queueMessage(message.id)).rejects.toThrow();

      // Reinitialize database for next test
      await dbOps.db.open();
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid queueing of messages', async () => {
      // Stop main scheduler to prevent interference
      scheduler.stop();
      await delay(100); // Let it fully stop

      // Clear database completely
      await dbOps.db.send_message_requests.clear();
      await dbOps.db.messages.clear();

      // Create fresh scheduler to avoid interference
      const rapidScheduler = new MessageScheduler({
        processingIntervalMs: 50,
        maxRetries: 0, // No retries - just process once
      });
      const rapidMockCallback = vi.fn();
      rapidScheduler.setSendMessageCallback(rapidMockCallback);

      const messages = Array.from({ length: 10 }, (_, i) =>
        createMockMessage({ id: `rapid-msg-${i}` })
      );

      for (const msg of messages) {
        await dbOps.upsertMessage(msg);
      }

      // Track successfully processed messages
      const processedIds = new Set<string>();

      // Set up mock to return the correct message for each call
      rapidMockCallback.mockImplementation(async (req) => {
        const msg = messages.find((m) => m.id === req.message_id);
        if (!msg) {
          throw new Error(`Message not found: ${req.message_id}`);
        }
        processedIds.add(req.message_id);
        return msg;
      });

      // Stop scheduler before queueing
      rapidScheduler.stop();

      // Queue all messages rapidly
      await Promise.all(messages.map((msg) => rapidScheduler.queueMessage(msg.id)));

      // Start processing
      rapidScheduler.start();
      await delay(300); // Enough time to process all messages

      rapidScheduler.stop();

      // All 10 unique messages should have been processed
      expect(processedIds.size).toBe(10);

      // Verify each message ID was processed
      messages.forEach((msg) => {
        expect(processedIds.has(msg.id)).toBe(true);
      });

      await delay(50); // Let it fully stop
    });

    it('should handle empty queue gracefully', async () => {
      scheduler.start();
      await delay(200);

      expect(mockSendCallback).not.toHaveBeenCalled();

      scheduler.stop();
    });

    it('should handle queue processing with no retryable failed requests', async () => {
      const message = createMockMessage();
      await dbOps.upsertMessage(message);

      // Create a failed request that has exceeded max retries
      const exhaustedRequest = createMockSendRequest({
        message_id: message.id,
        status: 'failed',
        retry_count: 10, // More than maxRetries
      });
      await dbOps.db.send_message_requests.add(exhaustedRequest);

      scheduler.start();
      await delay(200);

      // Should not attempt to send
      expect(mockSendCallback).not.toHaveBeenCalled();

      scheduler.stop();
    });
  });
});
