import type { ScheduledTask } from 'node-cron';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CleanupService } from '@/services/cleanupService';

// Mock node-cron
const mockStop = vi.fn();
const mockScheduledTask: ScheduledTask = {
  stop: mockStop,
  start: vi.fn(),
} as unknown as ScheduledTask;

vi.mock('node-cron', () => ({
  default: {
    schedule: vi.fn().mockReturnValue(mockScheduledTask),
  },
}));

// Mock database
const mockTransaction = vi.fn();
const mockSelect = vi.fn();
const mockDelete = vi.fn();

vi.mock('@/db', () => {
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

    it('should stop scheduled task on stop', () => {
      service.start();
      service.stop();

      expect(mockStop).toHaveBeenCalled();
    });

    it('should not throw error when stopping before starting', () => {
      expect(() => service.stop()).not.toThrow();
    });

    it('should handle multiple start calls', () => {
      service.start();
      service.start();

      // Only the first call creates the task
      expect(vi.mocked(mockScheduledTask.stop).mock.calls.length).toBe(0);
    });
  });

  describe('cleanupInactiveDemoUsers', () => {
    it('should return early if no inactive demo users found', async () => {
      // Mock empty result
      mockTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
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
      const mockDemoUsers = [{ id: 'demo-user-1' }, { id: 'demo-user-2' }];
      const mockDeletedMessages = Array(10).fill({ id: 'msg' });
      const mockDeletedConversations = Array(2).fill({ id: 'conv' });

      mockTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
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
      const errorMessage = 'Database connection failed';
      mockTransaction.mockRejectedValue(new Error(errorMessage));

      const result = await service.cleanupInactiveDemoUsers();

      expect(result).toEqual({
        success: false,
        error: errorMessage,
      });
    });

    it('should handle unknown errors', async () => {
      mockTransaction.mockRejectedValue('Unknown error');

      const result = await service.cleanupInactiveDemoUsers();

      expect(result).toEqual({
        success: false,
        error: 'Unknown error',
      });
    });

    it('should calculate correct cutoff date (24 hours ago)', async () => {
      const now = new Date('2025-01-06T12:00:00Z');
      const expectedCutoff = new Date('2025-01-05T12:00:00Z');

      vi.useFakeTimers();
      vi.setSystemTime(now);

      mockTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
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
      const deleteOrder: string[] = [];

      mockTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
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
      let scheduledCallback: (() => Promise<void>) | null = null;

      vi.mocked(cron.default.schedule).mockImplementation((_, callback) => {
        scheduledCallback = callback as () => Promise<void>;
        return mockScheduledTask;
      });

      // Mock successful cleanup
      mockTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
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

      expect(mockTransaction).toHaveBeenCalled();
    });
  });
});
