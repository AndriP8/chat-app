import { and, eq, inArray, lt } from 'drizzle-orm';
import cron, { type ScheduledTask } from 'node-cron';
import { conversationParticipants, conversations, db, messages, users } from '@/db';

export class CleanupService {
  private scheduledTask: ScheduledTask | null = null;

  start() {
    // Run cleanup every 6 hours
    this.scheduledTask = cron.schedule('0 */6 * * *', async () => {
      await this.cleanupInactiveDemoUsers();
    });

    console.log('✅ Cleanup service started - will run every 6 hours');
  }

  stop() {
    if (this.scheduledTask) {
      this.scheduledTask.stop();
      console.log('🛑 Cleanup service stopped');
    }
  }

  async cleanupInactiveDemoUsers() {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      console.log(`🧹 Starting cleanup of demo users inactive since ${oneDayAgo.toISOString()}`);

      const result = await db.transaction(async (tx) => {
        const demoUsers = await tx
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.is_demo, true), lt(users.updated_at, oneDayAgo)));

        if (!demoUsers.length) {
          console.log('ℹ️  No inactive demo users found');
          return { deletedUsers: 0, deletedMessages: 0, deletedConversations: 0 };
        }

        const demoUserIds = demoUsers.map((u) => u.id);

        const deletedMessages = await tx
          .delete(messages)
          .where(inArray(messages.sender_id, demoUserIds))
          .returning();

        await tx
          .delete(conversationParticipants)
          .where(inArray(conversationParticipants.user_id, demoUserIds))
          .returning();

        const deletedConversations = await tx
          .delete(conversations)
          .where(inArray(conversations.created_by, demoUserIds))
          .returning();

        const deletedUsers = await tx
          .delete(users)
          .where(inArray(users.id, demoUserIds))
          .returning();

        return {
          deletedUsers: deletedUsers.length,
          deletedMessages: deletedMessages.length,
          deletedConversations: deletedConversations.length,
        };
      });

      console.log(
        `✅ Cleanup completed: ${result.deletedUsers} users, ${result.deletedMessages} messages, ${result.deletedConversations} conversations`
      );

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      console.error('❌ Cleanup error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export const cleanupService = new CleanupService();
