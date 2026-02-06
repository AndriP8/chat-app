import type { User } from '@/types/database';

interface TypingUser {
  userId: string;
  userName: string;
  conversationId: string;
  timestamp: number;
}

class TypingIndicatorService {
  private typingUsers = new Map<string, Map<string, TypingUser>>();
  private typingTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

  private readonly TYPING_TIMEOUT = 3000;

  /**
   * Handle incoming typing event from server
   */
  handleUserTyping(event: {
    conversationId: string;
    userId: string;
    userName: string;
    isTyping: boolean;
  }): void {
    const { conversationId, userId, userName, isTyping } = event;

    if (isTyping) {
      this.addTypingUser(conversationId, userId, userName);
    } else {
      this.removeTypingUser(conversationId, userId);
    }
  }

  /**
   * Get typing users for a conversation
   */
  getTypingUsers(conversationId: string): User[] {
    const conversationTyping = this.typingUsers.get(conversationId);
    if (!conversationTyping) {
      return [];
    }

    return Array.from(conversationTyping.values()).map((typingUser) => ({
      id: typingUser.userId,
      name: typingUser.userName,
      email: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
  }

  private addTypingUser(conversationId: string, userId: string, userName: string): void {
    if (!this.typingUsers.has(conversationId)) {
      this.typingUsers.set(conversationId, new Map());
    }

    const conversationTyping = this.typingUsers.get(conversationId)!;
    conversationTyping.set(userId, {
      userId,
      userName,
      conversationId,
      timestamp: Date.now(),
    });

    this.resetTypingTimeout(conversationId, userId);
  }

  private removeTypingUser(conversationId: string, userId: string): void {
    const conversationTyping = this.typingUsers.get(conversationId);
    if (conversationTyping) {
      conversationTyping.delete(userId);
      if (conversationTyping.size === 0) {
        this.typingUsers.delete(conversationId);
      }
    }

    const key = `${userId}_${conversationId}`;
    const timeout = this.typingTimeouts.get(key);
    if (timeout) {
      clearTimeout(timeout);
      this.typingTimeouts.delete(key);
    }
  }

  private resetTypingTimeout(conversationId: string, userId: string): void {
    const key = `${userId}_${conversationId}`;

    const existingTimeout = this.typingTimeouts.get(key);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeout = setTimeout(() => {
      this.removeTypingUser(conversationId, userId);
      this.typingTimeouts.delete(key);
    }, this.TYPING_TIMEOUT);

    this.typingTimeouts.set(key, timeout);
  }
}

export const typingIndicatorService = new TypingIndicatorService();
