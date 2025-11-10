import type { Message } from '@/db/schema';
import { db, messages } from '@/db';
import { and, desc, eq, lt } from 'drizzle-orm';

interface BufferedMessage {
  message: Message;
  timestamp: Date;
}

interface SenderState {
  expectedSequence: number;
  buffer: Map<number, BufferedMessage>;
  gapTimer: NodeJS.Timeout | null;
}

interface OrderingConfig {
  gapTimeoutMs: number;
  maxBufferSize: number;
}

const DEFAULT_CONFIG: OrderingConfig = {
  gapTimeoutMs: 5000,
  maxBufferSize: 100,
};

export class MessageOrderingService {
  private senderStates = new Map<string, Map<string, SenderState>>();
  private config: OrderingConfig;
  constructor(config: Partial<OrderingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Process an incoming message with sequence number
   * Returns array of messages ready to be delivered (in order)
   */
  async processMessage(message: Message): Promise<Message[]> {
    if (message.sequence_number === null || message.sequence_number === undefined) {
      return [message];
    }

    const conversationId = message.conversation_id;
    const senderId = message.sender_id;
    const sequenceNumber = message.sequence_number;

    const senderState = await this.getOrCreateSenderState(conversationId, senderId, sequenceNumber);

    if (sequenceNumber === senderState.expectedSequence) {
      const deliverableMessages: Message[] = [message];
      senderState.expectedSequence++;

      if (senderState.gapTimer) {
        clearTimeout(senderState.gapTimer);
        senderState.gapTimer = null;
      }

      while (senderState.buffer.has(senderState.expectedSequence)) {
        const buffered = senderState.buffer.get(senderState.expectedSequence)!;
        deliverableMessages.push(buffered.message);
        senderState.buffer.delete(senderState.expectedSequence);
        senderState.expectedSequence++;
      }

      if (senderState.buffer.size === 0 && senderState.gapTimer) {
        clearTimeout(senderState.gapTimer);
        senderState.gapTimer = null;
      }

      return deliverableMessages;
    }
    if (sequenceNumber > senderState.expectedSequence) {
      if (senderState.buffer.size >= this.config.maxBufferSize) {
        return this.forceDelivery(conversationId, senderId);
      }

      senderState.buffer.set(sequenceNumber, {
        message,
        timestamp: new Date(),
      });

      if (!senderState.gapTimer) {
        senderState.gapTimer = setTimeout(() => {
          this.forceDelivery(conversationId, senderId);
        }, this.config.gapTimeoutMs);
      }

      return [];
    }
    return [];
  }

  private forceDelivery(conversationId: string, senderId: string): Message[] {
    const conversationStates = this.senderStates.get(conversationId);
    if (!conversationStates) return [];

    const senderState = conversationStates.get(senderId);
    if (!senderState) return [];

    if (senderState.gapTimer) {
      clearTimeout(senderState.gapTimer);
      senderState.gapTimer = null;
    }

    const bufferedMessages = Array.from(senderState.buffer.entries())
      .sort(([seqA], [seqB]) => seqA - seqB)
      .map(([_seq, buffered]) => buffered.message);

    if (bufferedMessages.length > 0) {
      const lastMessage = bufferedMessages[bufferedMessages.length - 1];
      if (lastMessage) {
        senderState.expectedSequence = (lastMessage.sequence_number ?? 0) + 1;
      }
    }

    senderState.buffer.clear();

    return bufferedMessages;
  }

  private async getOrCreateSenderState(
    conversationId: string,
    senderId: string,
    currentSequenceNumber: number
  ): Promise<SenderState> {
    if (!this.senderStates.has(conversationId)) {
      this.senderStates.set(conversationId, new Map());
    }

    const conversationStates = this.senderStates.get(conversationId)!;

    if (!conversationStates.has(senderId)) {
      try {
        const lastMessage = await db
          .select({ sequence_number: messages.sequence_number })
          .from(messages)
          .where(
            and(
              eq(messages.conversation_id, conversationId),
              eq(messages.sender_id, senderId),
              lt(messages.sequence_number, currentSequenceNumber)
            )
          )
          .orderBy(desc(messages.sequence_number))
          .limit(1);

        const expectedSequence = lastMessage[0]?.sequence_number
          ? lastMessage[0].sequence_number + 1
          : 1;

        conversationStates.set(senderId, {
          expectedSequence,
          buffer: new Map(),
          gapTimer: null,
        });
      } catch (error) {
        console.error(
          `[MessageOrdering] Error initializing sender state for ${senderId} in conversation ${conversationId}:`,
          error
        );
      }
    }

    return conversationStates.get(senderId)!;
  }
}

export const messageOrderingService = new MessageOrderingService();
