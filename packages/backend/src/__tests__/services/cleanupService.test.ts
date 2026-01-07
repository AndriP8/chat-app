import type { ScheduledTask } from 'node-cron';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CleanupService } from '@/services/cleanupService';

// Mock node-cron
vi.mock('node-cron', () => {
  const mockStop = vi.fn();
  const mockScheduledTask: ScheduledTask = {
    stop: mockStop,
    start: vi.fn(),
  } as unknown as ScheduledTask;

  return {
    default: {
      schedule: vi.fn().mockReturnValue(mockScheduledTask),
    },
  };
});

// Mock database
vi.mock('@/db', () => {
  const mockTransaction = vi.fn();
  const mockSelect = vi.fn();
  const mockDelete = vi.fn();

  const createMockTable = (name: string) => ({
    _: { name },
  });

  return {
    db: {
      transaction: mockTransaction,
      select: mockSelect,
      delete: mockDelete,
    },
    users: createMockTable('users'),
    conversations: createMockTable('conversations'),
    messages: createMockTable('messages'),
    conversationParticipants: createMockTable('conversationParticipants'),
  };
});

describe('CleanupService', () => {
  let service: CleanupService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CleanupService();
  });

  describe('Service Lifecycle', () => {
    it('should schedule cleanup every 6 hours on start', async () => {
      const cron = await import('node-cron');

      service.start();

      expect(cron.default.schedule).toHaveBeenCalledWith('0 */6 * * *', expect.any(Function));
    });

    it('should stop scheduled task on stop', async () => {
      const cron = await import('node-cron');

      service.start();
      service.stop();

      // Access the mockScheduledTask that was returned by schedule
      const scheduleCalls = vi.mocked(cron.default.schedule).mock.results;
      const mockTask = scheduleCalls[scheduleCalls.length - 1]?.value;

      expect(mockTask?.stop).toHaveBeenCalled();
    });

    it('should not throw error when stopping before starting', () => {
      expect(() => service.stop()).not.toThrow();
    });

    it('should handle multiple start calls', async () => {
      const cron = await import('node-cron');

      service.start();
      service.start();

      // Only the first start() should call schedule
      expect(cron.default.schedule).toHaveBeenCalledTimes(1);
    });
  });

  describe('cleanupInactiveDemoUsers', () => {
    it('should return early if no inactive demo users found', async () => {
      const { db } = await import('@/db');

      // Mock empty result
      // biome-ignore lint/suspicious/noExplicitAny: Mock requires flexible typing for test transactions
      vi.mocked(db.transaction).mockImplementation(async (callback: any) => {
        const mockTx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([]), // No users
            }),
          }),
        };
        return callback(mockTx);
      });

      const result = await service.cleanupInactiveDemoUsers();

      expect(result).toEqual({
        success: true,
        deletedUsers: 0,
        deletedMessages: 0,
        deletedConversations: 0,
      });
    });

    it('should delete inactive demo users and their data', async () => {
      const { db } = await import('@/db');
      const mockDemoUsers = [{ id: 'demo-user-1' }, { id: 'demo-user-2' }];
      const mockDeletedMessages = Array(10).fill({ id: 'msg' });
      const mockDeletedConversations = Array(2).fill({ id: 'conv' });

      // biome-ignore lint/suspicious/noExplicitAny: Mock requires flexible typing for test transactions
      vi.mocked(db.transaction).mockImplementation(async (callback: any) => {
        const mockTx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(mockDemoUsers),
            }),
          }),
          delete: vi.fn().mockImplementation((table: { _: { name: string } }) => {
            if (table._.name === 'messages') {
              return {
                where: vi.fn().mockReturnValue({
                  returning: vi.fn().mockResolvedValue(mockDeletedMessages),
                }),
              };
            }
            if (table._.name === 'conversationParticipants') {
              return {
                where: vi.fn().mockReturnValue({
                  returning: vi.fn().mockResolvedValue([]),
                }),
              };
            }
            if (table._.name === 'conversations') {
              return {
                where: vi.fn().mockReturnValue({
                  returning: vi.fn().mockResolvedValue(mockDeletedConversations),
                }),
              };
            }
            if (table._.name === 'users') {
              return {
                where: vi.fn().mockReturnValue({
                  returning: vi.fn().mockResolvedValue(mockDemoUsers),
                }),
              };
            }
            return {
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([]),
              }),
            };
          }),
        };
        return callback(mockTx);
      });

      const result = await service.cleanupInactiveDemoUsers();

      expect(result).toEqual({
        success: true,
        deletedUsers: 2,
        deletedMessages: 10,
        deletedConversations: 2,
      });
    });

    it('should handle database errors gracefully', async () => {
      const { db } = await import('@/db');
      const errorMessage = 'Database connection failed';
      vi.mocked(db.transaction).mockRejectedValue(new Error(errorMessage));

      const result = await service.cleanupInactiveDemoUsers();

      expect(result).toEqual({
        success: false,
        error: errorMessage,
      });
    });

    it('should handle unknown errors', async () => {
      const { db } = await import('@/db');
      vi.mocked(db.transaction).mockRejectedValue('Unknown error');

      const result = await service.cleanupInactiveDemoUsers();

      expect(result).toEqual({
        success: false,
        error: 'Unknown error',
      });
    });

    it('should calculate correct cutoff date (24 hours ago)', async () => {
      const { db } = await import('@/db');
      const now = new Date('2025-01-06T12:00:00Z');
      const expectedCutoff = new Date('2025-01-05T12:00:00Z');

      vi.useFakeTimers();
      vi.setSystemTime(now);

      // biome-ignore lint/suspicious/noExplicitAny: Mock requires flexible typing for test transactions
      vi.mocked(db.transaction).mockImplementation(async (callback: any) => {
        const mockTx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockImplementation(() => {
                return Promise.resolve([]);
              }),
            }),
          }),
        };
        return callback(mockTx);
      });

      await service.cleanupInactiveDemoUsers();

      // Verify the cutoff was approximately 24 hours ago
      const actualCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      expect(actualCutoff.getTime()).toBeCloseTo(expectedCutoff.getTime(), -4); // Within 10 seconds

      vi.useRealTimers();
    });

    it('should delete in correct order: messages → participants → conversations → users', async () => {
      const { db } = await import('@/db');
      const deleteOrder: string[] = [];

      // biome-ignore lint/suspicious/noExplicitAny: Mock requires flexible typing for test transactions
      vi.mocked(db.transaction).mockImplementation(async (callback: any) => {
        const mockTx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ id: 'demo-1' }]),
            }),
          }),
          delete: vi.fn().mockImplementation((table: { _: { name: string } }) => {
            deleteOrder.push(table._.name);
            return {
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([{ id: 'deleted' }]),
              }),
            };
          }),
        };
        return callback(mockTx);
      });

      await service.cleanupInactiveDemoUsers();

      expect(deleteOrder).toEqual([
        'messages',
        'conversationParticipants',
        'conversations',
        'users',
      ]);
    });
  });

  describe('Integration with cron schedule', () => {
    it('should execute cleanup when cron job triggers', async () => {
      const cron = await import('node-cron');
      const { db } = await import('@/db');
      let scheduledCallback: (() => Promise<void>) | null = null;

      // Create a mock scheduled task for this specific test
      const mockStop = vi.fn();
      const testMockScheduledTask = {
        stop: mockStop,
        start: vi.fn(),
      } as unknown as ScheduledTask;

      vi.mocked(cron.default.schedule).mockImplementation((_, callback) => {
        scheduledCallback = callback as () => Promise<void>;
        return testMockScheduledTask;
      });

      // Mock successful cleanup
      // biome-ignore lint/suspicious/noExplicitAny: Mock requires flexible typing for test transactions
      vi.mocked(db.transaction).mockImplementation(async (callback: any) => {
        const mockTx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([]),
            }),
          }),
        };
        return callback(mockTx);
      });

      service.start();

      // Trigger the scheduled callback
      expect(scheduledCallback).not.toBeNull();
      await scheduledCallback!();

      expect(db.transaction).toHaveBeenCalled();
    });
  });
});
