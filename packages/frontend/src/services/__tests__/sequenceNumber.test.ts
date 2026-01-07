import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetMockCounters } from '@/__tests__/utils/mockFactories';
import { db } from '../database';
import { getNextSequenceNumber } from '../sequenceNumber';

describe('SequenceNumber Service', () => {
  const conversationId = 'conv-test-1';
  const userId = 'user-test-1';

  beforeEach(async () => {
    resetMockCounters();
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    if (db.isOpen()) {
      db.close();
    }
  });

  describe('getNextSequenceNumber', () => {
    it('should return 1 for first sequence number', async () => {
      const sequenceNumber = await getNextSequenceNumber(conversationId, userId);

      expect(sequenceNumber).toBe(1);
    });

    it('should increment sequence number on subsequent calls', async () => {
      const seq1 = await getNextSequenceNumber(conversationId, userId);
      const seq2 = await getNextSequenceNumber(conversationId, userId);
      const seq3 = await getNextSequenceNumber(conversationId, userId);

      expect(seq1).toBe(1);
      expect(seq2).toBe(2);
      expect(seq3).toBe(3);
    });

    it('should store next_sequence correctly in database', async () => {
      await getNextSequenceNumber(conversationId, userId);

      const counter = await db.sequence_counters.get([conversationId, userId]);

      expect(counter).toBeDefined();
      expect(counter?.conversation_id).toBe(conversationId);
      expect(counter?.user_id).toBe(userId);
      expect(counter?.next_sequence).toBe(2); // Next one will be 2
    });

    it('should handle multiple conversations independently', async () => {
      const conv1 = 'conv-1';
      const conv2 = 'conv-2';

      const seq1Conv1 = await getNextSequenceNumber(conv1, userId);
      const seq1Conv2 = await getNextSequenceNumber(conv2, userId);
      const seq2Conv1 = await getNextSequenceNumber(conv1, userId);
      const seq2Conv2 = await getNextSequenceNumber(conv2, userId);

      expect(seq1Conv1).toBe(1);
      expect(seq1Conv2).toBe(1);
      expect(seq2Conv1).toBe(2);
      expect(seq2Conv2).toBe(2);
    });

    it('should handle multiple users in same conversation independently', async () => {
      const user1 = 'user-1';
      const user2 = 'user-2';

      const seq1User1 = await getNextSequenceNumber(conversationId, user1);
      const seq1User2 = await getNextSequenceNumber(conversationId, user2);
      const seq2User1 = await getNextSequenceNumber(conversationId, user1);
      const seq2User2 = await getNextSequenceNumber(conversationId, user2);

      expect(seq1User1).toBe(1);
      expect(seq1User2).toBe(1);
      expect(seq2User1).toBe(2);
      expect(seq2User2).toBe(2);
    });

    it('should generate sequential numbers without gaps', async () => {
      const count = 10;
      const sequences: number[] = [];

      for (let i = 0; i < count; i++) {
        sequences.push(await getNextSequenceNumber(conversationId, userId));
      }

      // Verify no gaps and correct ordering
      for (let i = 0; i < count; i++) {
        expect(sequences[i]).toBe(i + 1);
      }
    });

    it('should be atomic and thread-safe (concurrent calls)', async () => {
      // Simulate rapid concurrent calls
      const promises = Array.from({ length: 5 }, () =>
        getNextSequenceNumber(conversationId, userId)
      );

      const results = await Promise.all(promises);

      // All results should be unique
      const uniqueResults = new Set(results);
      expect(uniqueResults.size).toBe(5);

      // Results should be sequential (1, 2, 3, 4, 5) in some order
      const sortedResults = [...results].sort((a, b) => a - b);
      expect(sortedResults).toEqual([1, 2, 3, 4, 5]);
    });

    it('should update timestamp on each call', async () => {
      await getNextSequenceNumber(conversationId, userId);
      const counter1 = await db.sequence_counters.get([conversationId, userId]);

      // Wait a bit to ensure timestamp differs
      await new Promise((resolve) => setTimeout(resolve, 10));

      await getNextSequenceNumber(conversationId, userId);
      const counter2 = await db.sequence_counters.get([conversationId, userId]);

      expect(counter2?.updated_at.getTime()).toBeGreaterThan(counter1?.updated_at.getTime() || 0);
    });

    it('should handle very large sequence numbers', async () => {
      // Set initial sequence to a large number
      await db.sequence_counters.put({
        conversation_id: conversationId,
        user_id: userId,
        next_sequence: 999999,
        updated_at: new Date(),
      });

      const seq = await getNextSequenceNumber(conversationId, userId);

      expect(seq).toBe(999999);

      // Verify it can increment from large numbers
      const nextSeq = await getNextSequenceNumber(conversationId, userId);
      expect(nextSeq).toBe(1000000);
    });

    it('should throw error if database is closed', async () => {
      db.close();

      await expect(getNextSequenceNumber(conversationId, userId)).rejects.toThrow();
    });

    it('should throw error with descriptive message on failure', async () => {
      db.close();

      try {
        await getNextSequenceNumber(conversationId, userId);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Failed to generate sequence number');
      }
    });

    it('should maintain sequence across database reopens', async () => {
      const seq1 = await getNextSequenceNumber(conversationId, userId);
      const seq2 = await getNextSequenceNumber(conversationId, userId);

      expect(seq1).toBe(1);
      expect(seq2).toBe(2);

      // Close and reopen database
      db.close();
      await db.open();

      const seq3 = await getNextSequenceNumber(conversationId, userId);
      const seq4 = await getNextSequenceNumber(conversationId, userId);

      expect(seq3).toBe(3);
      expect(seq4).toBe(4);
    });

    it('should handle rapid-fire sequence generation for offline queue', async () => {
      // Simulate user sending 20 messages while offline
      const sequencePromises = Array.from({ length: 20 }, () =>
        getNextSequenceNumber(conversationId, userId)
      );

      const sequences = await Promise.all(sequencePromises);

      // Verify all are unique and sequential
      const sorted = [...sequences].sort((a, b) => a - b);
      expect(sorted).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    });

    it('should use composite key correctly (conversation + user)', async () => {
      await getNextSequenceNumber('conv-1', 'user-1');
      await getNextSequenceNumber('conv-1', 'user-2');

      const counter1 = await db.sequence_counters.get(['conv-1', 'user-1']);
      const counter2 = await db.sequence_counters.get(['conv-1', 'user-2']);

      expect(counter1?.next_sequence).toBe(2);
      expect(counter2?.next_sequence).toBe(2);

      // Verify they are different records
      const allCounters = await db.sequence_counters.toArray();
      expect(allCounters.length).toBe(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string IDs gracefully', async () => {
      // This tests defensive programming - empty IDs should still work technically
      const seq = await getNextSequenceNumber('', '');
      expect(seq).toBe(1);
    });

    it('should handle special characters in IDs', async () => {
      const specialConvId = 'conv-with-special-chars-!@#$%';
      const specialUserId = 'user-with-special-chars-^&*()';

      const seq1 = await getNextSequenceNumber(specialConvId, specialUserId);
      const seq2 = await getNextSequenceNumber(specialConvId, specialUserId);

      expect(seq1).toBe(1);
      expect(seq2).toBe(2);
    });

    it('should handle very long ID strings', async () => {
      const longId = 'a'.repeat(1000);

      const seq = await getNextSequenceNumber(longId, longId);

      expect(seq).toBe(1);
    });

    it('should handle interleaved calls for different conversations', async () => {
      const results: { conv: string; user: string; seq: number }[] = [];

      // Interleaved pattern
      results.push({ conv: 'c1', user: 'u1', seq: await getNextSequenceNumber('c1', 'u1') });
      results.push({ conv: 'c2', user: 'u1', seq: await getNextSequenceNumber('c2', 'u1') });
      results.push({ conv: 'c1', user: 'u1', seq: await getNextSequenceNumber('c1', 'u1') });
      results.push({ conv: 'c2', user: 'u1', seq: await getNextSequenceNumber('c2', 'u1') });
      results.push({ conv: 'c1', user: 'u2', seq: await getNextSequenceNumber('c1', 'u2') });

      expect(results[0].seq).toBe(1); // c1/u1: 1
      expect(results[1].seq).toBe(1); // c2/u1: 1
      expect(results[2].seq).toBe(2); // c1/u1: 2
      expect(results[3].seq).toBe(2); // c2/u1: 2
      expect(results[4].seq).toBe(1); // c1/u2: 1
    });
  });

  describe('Performance', () => {
    it('should handle 100 sequential calls efficiently', async () => {
      const start = Date.now();

      for (let i = 0; i < 100; i++) {
        await getNextSequenceNumber(conversationId, userId);
      }

      const duration = Date.now() - start;

      // Should complete in reasonable time (less than 1 second)
      expect(duration).toBeLessThan(1000);
    });

    it('should handle 50 concurrent calls efficiently', async () => {
      const start = Date.now();

      const promises = Array.from({ length: 50 }, () =>
        getNextSequenceNumber(conversationId, userId)
      );

      await Promise.all(promises);

      const duration = Date.now() - start;

      // Should complete in reasonable time (less than 1 second)
      expect(duration).toBeLessThan(1000);
    });
  });
});
