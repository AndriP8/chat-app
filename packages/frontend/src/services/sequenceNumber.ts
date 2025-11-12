import { db } from './database';

export async function getNextSequenceNumber(
  conversationId: string,
  userId: string
): Promise<number> {
  try {
    return await db.transaction('rw', db.sequence_counters, async () => {
      const existingCounter = await db.sequence_counters.get([conversationId, userId]);

      let nextSequence: number;

      if (existingCounter) {
        nextSequence = existingCounter.next_sequence;
        await db.sequence_counters.put({
          conversation_id: conversationId,
          user_id: userId,
          next_sequence: nextSequence + 1,
          updated_at: new Date(),
        });
      } else {
        nextSequence = 1;
        await db.sequence_counters.put({
          conversation_id: conversationId,
          user_id: userId,
          next_sequence: 2, // Next one will be 2
          updated_at: new Date(),
        });
      }

      return nextSequence;
    });
  } catch (error) {
    console.error('Error getting next sequence number:', error);
    throw new Error(`Failed to generate sequence number: ${error}`);
  }
}
