import type { Message } from '@/db/schema';

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
  gapTimeoutMs: 5000, // 5 seconds to wait for missing messages
  maxBufferSize: 100, // Max buffered messages per sender
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

    const senderState = this.getOrCreateSenderState(conversationId, senderId);

    // Check if this is the expected message
    if (sequenceNumber === senderState.expectedSequence) {
      const deliverableMessages: Message[] = [message];
      senderState.expectedSequence++;

      if (senderState.gapTimer) {
        clearTimeout(senderState.gapTimer);
        senderState.gapTimer = null;
      }

      // Check buffer for consecutive messages
      while (senderState.buffer.has(senderState.expectedSequence)) {
        const buffered = senderState.buffer.get(senderState.expectedSequence)!;
        deliverableMessages.push(buffered.message);
        senderState.buffer.delete(senderState.expectedSequence);
        senderState.expectedSequence++;
      }

      // If buffer is now empty, no need for gap timer
      if (senderState.buffer.size === 0 && senderState.gapTimer) {
        clearTimeout(senderState.gapTimer);
        senderState.gapTimer = null;
      }

      return deliverableMessages;
    }
    if (sequenceNumber > senderState.expectedSequence) {
      // Check buffer size limit
      if (senderState.buffer.size >= this.config.maxBufferSize) {
        return this.forceDelivery(conversationId, senderId);
      }

      // Add to buffer
      senderState.buffer.set(sequenceNumber, {
        message,
        timestamp: new Date(),
      });

      // Start gap timer if not already running
      if (!senderState.gapTimer) {
        senderState.gapTimer = setTimeout(() => {
          this.forceDelivery(conversationId, senderId);
        }, this.config.gapTimeoutMs);
      }

      // Return empty array - message is buffered
      return [];
    }
    return [];
  }

  /**
   * Force delivery of all buffered messages for a sender
   * Used when gap timeout is reached or buffer is full
   */
  private forceDelivery(conversationId: string, senderId: string): Message[] {
    const conversationStates = this.senderStates.get(conversationId);
    if (!conversationStates) return [];

    const senderState = conversationStates.get(senderId);
    if (!senderState) return [];

    if (senderState.gapTimer) {
      clearTimeout(senderState.gapTimer);
      senderState.gapTimer = null;
    }

    // Get all buffered messages sorted by sequence number
    const bufferedMessages = Array.from(senderState.buffer.entries())
      .sort(([seqA], [seqB]) => seqA - seqB)
      .map(([_seq, buffered]) => buffered.message);

    // Update expected sequence to the highest sequence + 1
    if (bufferedMessages.length > 0) {
      const lastMessage = bufferedMessages[bufferedMessages.length - 1];
      if (lastMessage) {
        senderState.expectedSequence = (lastMessage.sequence_number ?? 0) + 1;
      }
    }

    // Clear buffer
    senderState.buffer.clear();

    return bufferedMessages;
  }

  /**
   * Get or create sender state
   */
  private getOrCreateSenderState(conversationId: string, senderId: string): SenderState {
    if (!this.senderStates.has(conversationId)) {
      this.senderStates.set(conversationId, new Map());
    }

    const conversationStates = this.senderStates.get(conversationId)!;

    if (!conversationStates.has(senderId)) {
      conversationStates.set(senderId, {
        expectedSequence: 1, // Start from 1
        buffer: new Map(),
        gapTimer: null,
      });
    }

    return conversationStates.get(senderId)!;
  }
}

// Export singleton instance
export const messageOrderingService = new MessageOrderingService();
