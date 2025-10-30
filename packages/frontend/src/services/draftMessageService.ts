import { dbOps } from './databaseOperations';
import type { DraftMessage } from '../types/database';

export class DraftMessageService {
  private saveTimeouts = new Map<string, number>();
  private readonly DEBOUNCE_DELAY = 1000; // 1 second debounce

  /**
   * Save draft message with debouncing
   */
  async saveDraftDebounced(conversationId: string, userId: string, content: string): Promise<void> {
    const key = `${conversationId}_${userId}`;

    const existingTimeout = this.saveTimeouts.get(key);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeout = setTimeout(async () => {
      try {
        await this.saveDraftImmediate(conversationId, userId, content);
        this.saveTimeouts.delete(key);
      } catch (error) {
        console.error('Failed to save draft message:', error);
      }
    }, this.DEBOUNCE_DELAY);

    this.saveTimeouts.set(key, timeout);
    console.log(this.saveTimeouts.forEach((value, key) => console.log(key, value)));
  }

  /**
   * Save draft message immediately without debouncing
   */
  private async saveDraftImmediate(
    conversationId: string,
    userId: string,
    content: string
  ): Promise<DraftMessage> {
    if (!content.trim()) {
      await this.deleteDraft(conversationId, userId);
    }

    return await dbOps.saveDraftMessage({
      conversation_id: conversationId,
      user_id: userId,
      content: content.trim(),
    });
  }

  /**
   * Get draft message for a conversation
   */
  async getDraft(conversationId: string, userId: string): Promise<DraftMessage | undefined> {
    return await dbOps.getDraftMessage(conversationId, userId);
  }

  /**
   * Delete draft message for a conversation
   */
  async deleteDraft(conversationId: string, userId: string): Promise<void> {
    const key = `${conversationId}_${userId}`;

    // Clear any pending save timeout
    const existingTimeout = this.saveTimeouts.get(key);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.saveTimeouts.delete(key);
    }

    // Delete from database
    await dbOps.deleteDraftMessage(conversationId, userId);
  }

  /**
   * Save draft on blur event (when user leaves the input field)
   */
  async saveDraftOnBlur(conversationId: string, userId: string, content: string): Promise<void> {
    this.saveDraftImmediate(conversationId, userId, content);
  }
}

export const draftMessageService = new DraftMessageService();
