import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createMockConversation,
  createMockDraft,
  createMockMessage,
  createMockUser,
  resetMockCounters,
} from '@/__tests__/utils/mockFactories';
import type { DraftMessage, Message, SendMessageRequest } from '@/types/database';
import { DatabaseOperations } from '../databaseOperations';

describe('DatabaseOperations', () => {
  let dbOps: DatabaseOperations;

  beforeEach(async () => {
    resetMockCounters();
    dbOps = new DatabaseOperations();
    await dbOps.db.delete();
    await dbOps.db.open();
  });

  afterEach(async () => {
    await dbOps.db.close();
  });

  describe('User Operations', () => {
    it('should upsert a new user', async () => {
      const user = createMockUser();
      const result = await dbOps.upsertUser(user);

      expect(result.id).toBe(user.id);
      expect(result.name).toBe(user.name);
      expect(result.email).toBe(user.email);
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should update an existing user', async () => {
      const user = createMockUser({ name: 'Original Name' });
      await dbOps.upsertUser(user);

      const updatedUser = { ...user, name: 'Updated Name' };
      const result = await dbOps.upsertUser(updatedUser);

      expect(result.name).toBe('Updated Name');
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should get user by ID', async () => {
      const user = createMockUser();
      await dbOps.upsertUser(user);

      const result = await dbOps.getUser(user.id);

      expect(result).toBeDefined();
      expect(result?.id).toBe(user.id);
    });

    it('should return undefined for non-existent user', async () => {
      const result = await dbOps.getUser('non-existent-id');

      expect(result).toBeUndefined();
    });
  });

  describe('Conversation Operations', () => {
    it('should upsert a new conversation', async () => {
      const conversation = createMockConversation();
      const result = await dbOps.upsertConversation(conversation);

      expect(result.id).toBe(conversation.id);
      expect(result.name).toBe(conversation.name);
      expect(result.created_by).toBe(conversation.created_by);
    });

    it('should update an existing conversation', async () => {
      const conversation = createMockConversation({ name: 'Original Name' });
      await dbOps.upsertConversation(conversation);

      const updatedConversation = { ...conversation, name: 'Updated Name' };
      const result = await dbOps.upsertConversation(updatedConversation);

      expect(result.name).toBe('Updated Name');
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should get user conversations with participants and last message', async () => {
      const user1 = createMockUser({ name: 'Alice' });
      const user2 = createMockUser({ name: 'Bob' });
      const conversation = createMockConversation({ created_by: user1.id });
      const message = createMockMessage({
        conversation_id: conversation.id,
        sender_id: user1.id,
      });

      await dbOps.upsertUser(user1);
      await dbOps.upsertUser(user2);
      await dbOps.upsertConversation(conversation);
      await dbOps.addConversationParticipant({
        conversation_id: conversation.id,
        user_id: user1.id,
      });
      await dbOps.addConversationParticipant({
        conversation_id: conversation.id,
        user_id: user2.id,
      });
      await dbOps.upsertMessage(message);

      const result = await dbOps.getUserConversations(user1.id);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(conversation.id);
      expect(result[0].participants).toHaveLength(2);
      expect(result[0].last_message).toBeDefined();
      expect(result[0].last_message?.id).toBe(message.id);
    });

    it('should return empty array if user has no conversations', async () => {
      const user = createMockUser();
      await dbOps.upsertUser(user);

      const result = await dbOps.getUserConversations(user.id);

      expect(result).toEqual([]);
    });
  });

  describe('Message Operations', () => {
    describe('upsertMessage', () => {
      it('should insert a new message', async () => {
        const message = createMockMessage();
        const result = await dbOps.upsertMessage(message);

        expect(result.id).toBe(message.id);
        expect(result.content).toBe(message.content);
        expect(result.status).toBe(message.status);
        expect(result.created_at).toBeInstanceOf(Date);
        expect(result.updated_at).toBeInstanceOf(Date);
      });

      it('should update an existing message', async () => {
        const message = createMockMessage({ status: 'sending' });
        await dbOps.upsertMessage(message);

        const updatedMessage = { ...message, status: 'sent' as Message['status'] };
        const result = await dbOps.upsertMessage(updatedMessage);

        expect(result.status).toBe('sent');
      });

      it('should preserve created_at when updating', async () => {
        const message = createMockMessage();
        const inserted = await dbOps.upsertMessage(message);
        const originalCreatedAt = inserted.created_at;

        await new Promise((resolve) => setTimeout(resolve, 10));

        const updatedMessage = { ...message, content: 'Updated content' };
        const result = await dbOps.upsertMessage(updatedMessage);

        expect(result.created_at.getTime()).toBe(originalCreatedAt.getTime());
      });
    });

    describe('replaceTemporaryMessage', () => {
      it('should replace temporary message with server message', async () => {
        const tempId = 'temp-123';
        const tempMessage = createMockMessage({ id: tempId, tempId, status: 'sending' });
        await dbOps.upsertMessage(tempMessage);

        const serverMessage = createMockMessage({ id: 'server-id-456', status: 'sent' });
        const result = await dbOps.replaceTemporaryMessage(tempId, serverMessage);

        expect(result.id).toBe('server-id-456');
        expect(result.tempId).toBeUndefined();
        expect(result.status).toBe('sent');

        // Verify temp message is deleted
        const tempStillExists = await dbOps.getMessageById(tempId);
        expect(tempStillExists).toBeUndefined();
      });

      it('should handle replace when temp message does not exist', async () => {
        const serverMessage = createMockMessage({ id: 'server-id-789', status: 'sent' });
        const result = await dbOps.replaceTemporaryMessage('non-existent-temp-id', serverMessage);

        expect(result.id).toBe('server-id-789');
        expect(result.tempId).toBeUndefined();
      });
    });

    describe('getConversationMessages', () => {
      it('should get messages with pagination limit', async () => {
        const conversationId = 'conv-1';
        const messages = Array.from({ length: 100 }, (_, i) =>
          createMockMessage({ conversation_id: conversationId, content: `Message ${i}` })
        );

        for (const msg of messages) {
          await dbOps.upsertMessage(msg);
        }

        const result = await dbOps.getConversationMessages(conversationId, { limit: 50 });

        expect(result).toHaveLength(50);
      });

      it('should filter by next_cursor', async () => {
        const conversationId = 'conv-1';
        const msg1 = createMockMessage({ id: 'msg-1', conversation_id: conversationId });
        const msg2 = createMockMessage({ id: 'msg-2', conversation_id: conversationId });
        const msg3 = createMockMessage({ id: 'msg-3', conversation_id: conversationId });

        await dbOps.upsertMessage(msg1);
        await dbOps.upsertMessage(msg2);
        await dbOps.upsertMessage(msg3);

        const result = await dbOps.getConversationMessages(conversationId, {
          next_cursor: 'msg-3',
        });

        // Should return messages with ID < 'msg-3'
        expect(result.every((m) => m.id < 'msg-3')).toBe(true);
      });

      it('should filter by after date', async () => {
        const conversationId = 'conv-1';
        const cutoffDate = new Date('2025-01-01T00:00:00Z');

        const oldMsg = createMockMessage({
          conversation_id: conversationId,
          created_at: new Date('2024-12-31T23:59:59Z'),
        });
        const newMsg = createMockMessage({
          conversation_id: conversationId,
          created_at: new Date('2025-01-01T00:00:01Z'),
        });

        await dbOps.upsertMessage(oldMsg);
        await dbOps.upsertMessage(newMsg);

        const result = await dbOps.getConversationMessages(conversationId, {
          after: cutoffDate,
        });

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(newMsg.id);
      });

      it('should sort by created_at then sequence_number', async () => {
        const conversationId = 'conv-1';
        const timestamp = new Date('2025-01-01T12:00:00Z');

        const msg1 = createMockMessage({
          conversation_id: conversationId,
          created_at: timestamp,
          sequence_number: 2,
        });
        const msg2 = createMockMessage({
          conversation_id: conversationId,
          created_at: timestamp,
          sequence_number: 1,
        });
        const msg3 = createMockMessage({
          conversation_id: conversationId,
          created_at: new Date('2025-01-01T11:59:00Z'),
          sequence_number: 3,
        });

        await dbOps.upsertMessage(msg1);
        await dbOps.upsertMessage(msg2);
        await dbOps.upsertMessage(msg3);

        const result = await dbOps.getConversationMessages(conversationId);

        expect(result[0].id).toBe(msg3.id); // Earlier timestamp
        expect(result[1].id).toBe(msg2.id); // Same timestamp, lower sequence
        expect(result[2].id).toBe(msg1.id); // Same timestamp, higher sequence
      });
    });

    describe('getMessageById', () => {
      it('should retrieve message by ID', async () => {
        const message = createMockMessage();
        await dbOps.upsertMessage(message);

        const result = await dbOps.getMessageById(message.id);

        expect(result).toBeDefined();
        expect(result?.id).toBe(message.id);
      });

      it('should return undefined for non-existent message', async () => {
        const result = await dbOps.getMessageById('non-existent-id');

        expect(result).toBeUndefined();
      });
    });

    describe('getMessageByTempId', () => {
      it('should retrieve message by tempId', async () => {
        const message = createMockMessage({ tempId: 'temp-abc' });
        await dbOps.upsertMessage(message);

        const result = await dbOps.getMessageByTempId('temp-abc');

        expect(result).toBeDefined();
        expect(result?.tempId).toBe('temp-abc');
      });

      it('should return undefined for non-existent tempId', async () => {
        const result = await dbOps.getMessageByTempId('non-existent-temp-id');

        expect(result).toBeUndefined();
      });
    });

    describe('updateMessageStatus', () => {
      it('should update message status', async () => {
        const message = createMockMessage({ status: 'sending' });
        await dbOps.upsertMessage(message);

        await dbOps.updateMessageStatus(message.id, 'sent');

        const updated = await dbOps.getMessageById(message.id);
        expect(updated?.status).toBe('sent');
      });
    });

    describe('hasOlderMessages', () => {
      it('should return true if older messages exist', async () => {
        const conversationId = 'conv-1';
        const oldMsg = createMockMessage({
          id: 'msg-old',
          conversation_id: conversationId,
          created_at: new Date('2025-01-01T10:00:00Z'),
        });
        const newerMsg = createMockMessage({
          id: 'msg-new',
          conversation_id: conversationId,
          created_at: new Date('2025-01-01T12:00:00Z'),
        });

        await dbOps.upsertMessage(oldMsg);
        await dbOps.upsertMessage(newerMsg);

        const result = await dbOps.hasOlderMessages(conversationId, newerMsg.id);

        expect(result).toBe(true);
      });

      it('should return false if no older messages exist', async () => {
        const conversationId = 'conv-1';
        const msg = createMockMessage({ conversation_id: conversationId });

        await dbOps.upsertMessage(msg);

        const result = await dbOps.hasOlderMessages(conversationId, msg.id);

        expect(result).toBe(false);
      });

      it('should return false for non-existent message', async () => {
        const result = await dbOps.hasOlderMessages('conv-1', 'non-existent-msg-id');

        expect(result).toBe(false);
      });
    });
  });

  describe('Pagination Metadata Operations', () => {
    it('should upsert pagination metadata (insert)', async () => {
      const conversationId = 'conv-1';
      const metadata = {
        has_more: true,
        next_cursor: 'cursor-123',
        last_message_id: 'msg-123',
      };

      const result = await dbOps.upsertPaginationMetadata(conversationId, metadata);

      expect(result.conversation_id).toBe(conversationId);
      expect(result.has_more).toBe(true);
      expect(result.next_cursor).toBe('cursor-123');
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should upsert pagination metadata (update)', async () => {
      const conversationId = 'conv-1';
      await dbOps.upsertPaginationMetadata(conversationId, {
        has_more: true,
        next_cursor: 'cursor-old',
        last_message_id: 'msg-old',
      });

      const result = await dbOps.upsertPaginationMetadata(conversationId, {
        has_more: false,
        next_cursor: 'cursor-new',
        last_message_id: 'msg-new',
      });

      expect(result.has_more).toBe(false);
      expect(result.next_cursor).toBe('cursor-new');
    });

    it('should get pagination metadata', async () => {
      const conversationId = 'conv-1';
      await dbOps.upsertPaginationMetadata(conversationId, {
        has_more: true,
        next_cursor: 'cursor-123',
        last_message_id: 'msg-123',
      });

      const result = await dbOps.getPaginationMetadata(conversationId);

      expect(result).toBeDefined();
      expect(result?.has_more).toBe(true);
    });

    it('should return undefined for non-existent pagination metadata', async () => {
      const result = await dbOps.getPaginationMetadata('non-existent-conv-id');

      expect(result).toBeUndefined();
    });

    it('should clear pagination metadata', async () => {
      const conversationId = 'conv-1';
      await dbOps.upsertPaginationMetadata(conversationId, {
        has_more: true,
        next_cursor: 'cursor-123',
        last_message_id: 'msg-123',
      });

      await dbOps.clearPaginationMetadata(conversationId);

      const result = await dbOps.getPaginationMetadata(conversationId);
      expect(result).toBeUndefined();
    });
  });

  describe('Conversation Participant Operations', () => {
    it('should add conversation participant', async () => {
      const participant = {
        conversation_id: 'conv-1',
        user_id: 'user-1',
      };

      const result = await dbOps.addConversationParticipant(participant);

      expect(result.conversation_id).toBe(participant.conversation_id);
      expect(result.user_id).toBe(participant.user_id);
    });

    it('should return existing participant if duplicate', async () => {
      const participant = {
        conversation_id: 'conv-1',
        user_id: 'user-1',
      };

      await dbOps.addConversationParticipant(participant);
      const result = await dbOps.addConversationParticipant(participant);

      expect(result.conversation_id).toBe(participant.conversation_id);
    });
  });

  describe('Send Message Request Operations', () => {
    it('should create send message request with generated ID', async () => {
      const request: Omit<SendMessageRequest, 'id' | 'created_at'> = {
        message_id: 'msg-123',
        status: 'pending',
        retry_count: 0,
        last_sent_at: undefined,
        error_message: undefined,
      };

      const result = await dbOps.createSendMessageRequest(request);

      expect(result.id).toContain('msg-123');
      expect(result.status).toBe('pending');
      expect(result.created_at).toBeInstanceOf(Date);
    });

    it('should get pending send requests sorted by created_at', async () => {
      const req1 = await dbOps.createSendMessageRequest({
        message_id: 'msg-1',
        status: 'pending',
        retry_count: 0,
        last_sent_at: undefined,
        error_message: undefined,
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const req2 = await dbOps.createSendMessageRequest({
        message_id: 'msg-2',
        status: 'pending',
        retry_count: 0,
        last_sent_at: undefined,
        error_message: undefined,
      });

      const result = await dbOps.getPendingSendRequests();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(req1.id);
      expect(result[1].id).toBe(req2.id);
    });

    it('should update send request status', async () => {
      const req = await dbOps.createSendMessageRequest({
        message_id: 'msg-1',
        status: 'pending',
        retry_count: 0,
        last_sent_at: undefined,
        error_message: undefined,
      });

      await dbOps.updateSendRequestStatus(req.id, 'in_flight');

      const updated = await dbOps.db.send_message_requests.get(req.id);
      expect(updated?.status).toBe('in_flight');
      expect(updated?.last_sent_at).toBeInstanceOf(Date);
    });

    it('should increment retry_count when status is failed', async () => {
      const req = await dbOps.createSendMessageRequest({
        message_id: 'msg-1',
        status: 'pending',
        retry_count: 0,
        last_sent_at: undefined,
        error_message: undefined,
      });

      await dbOps.updateSendRequestStatus(req.id, 'failed', 'Network error');

      const updated = await dbOps.db.send_message_requests.get(req.id);
      expect(updated?.status).toBe('failed');
      expect(updated?.retry_count).toBe(1);
      expect(updated?.error_message).toBe('Network error');
    });

    it('should delete send request', async () => {
      const req = await dbOps.createSendMessageRequest({
        message_id: 'msg-1',
        status: 'pending',
        retry_count: 0,
        last_sent_at: undefined,
        error_message: undefined,
      });

      await dbOps.deleteSendRequest(req.id);

      const deleted = await dbOps.db.send_message_requests.get(req.id);
      expect(deleted).toBeUndefined();
    });

    it('should get send request by message ID', async () => {
      await dbOps.createSendMessageRequest({
        message_id: 'msg-unique-123',
        status: 'pending',
        retry_count: 0,
        last_sent_at: undefined,
        error_message: undefined,
      });

      const result = await dbOps.getSendRequestByMessageId('msg-unique-123');

      expect(result).toBeDefined();
      expect(result?.message_id).toBe('msg-unique-123');
    });

    it('should get send requests by status', async () => {
      await dbOps.createSendMessageRequest({
        message_id: 'msg-1',
        status: 'pending',
        retry_count: 0,
        last_sent_at: undefined,
        error_message: undefined,
      });

      await dbOps.createSendMessageRequest({
        message_id: 'msg-2',
        status: 'failed',
        retry_count: 3,
        last_sent_at: undefined,
        error_message: 'Error',
      });

      const failedRequests = await dbOps.getSendRequestsByStatus('failed');

      expect(failedRequests).toHaveLength(1);
      expect(failedRequests[0].status).toBe('failed');
    });
  });

  describe('Draft Message Operations', () => {
    it('should save a new draft message', async () => {
      const draft: Omit<DraftMessage, 'id' | 'created_at' | 'updated_at'> = {
        conversation_id: 'conv-1',
        user_id: 'user-1',
        content: 'Draft content',
      };

      const result = await dbOps.saveDraftMessage(draft);

      expect(result.id).toContain('draft');
      expect(result.content).toBe('Draft content');
      expect(result.created_at).toBeInstanceOf(Date);
    });

    it('should update existing draft message', async () => {
      const draft: Omit<DraftMessage, 'id' | 'created_at' | 'updated_at'> = {
        conversation_id: 'conv-1',
        user_id: 'user-1',
        content: 'Original draft',
      };

      await dbOps.saveDraftMessage(draft);

      const updatedDraft = { ...draft, content: 'Updated draft' };
      const result = await dbOps.saveDraftMessage(updatedDraft);

      expect(result.content).toBe('Updated draft');
    });

    it('should get draft message by conversation and user', async () => {
      const draft = createMockDraft({ conversation_id: 'conv-1', user_id: 'user-1' });
      await dbOps.db.draft_messages.add(draft);

      const result = await dbOps.getDraftMessage('conv-1', 'user-1');

      expect(result).toBeDefined();
      expect(result?.content).toBe(draft.content);
    });

    it('should delete draft message', async () => {
      const draft = createMockDraft({ conversation_id: 'conv-1', user_id: 'user-1' });
      await dbOps.db.draft_messages.add(draft);

      await dbOps.deleteDraftMessage('conv-1', 'user-1');

      const deleted = await dbOps.getDraftMessage('conv-1', 'user-1');
      expect(deleted).toBeUndefined();
    });
  });

  describe('Cleanup Operations', () => {
    it('should cleanup failed temporary messages older than specified time', async () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 25 * 60 * 60 * 1000); // 25 hours ago

      const oldFailedTemp = createMockMessage({
        tempId: 'temp-old',
        status: 'failed',
        created_at: oldDate,
      });
      const recentFailedTemp = createMockMessage({
        tempId: 'temp-recent',
        status: 'failed',
        created_at: now,
      });

      await dbOps.upsertMessage(oldFailedTemp);
      await dbOps.upsertMessage(recentFailedTemp);

      const deletedCount = await dbOps.cleanupFailedTemporaryMessages(24);

      expect(deletedCount).toBe(1);

      const stillExists = await dbOps.getMessageByTempId('temp-recent');
      expect(stillExists).toBeDefined();
    });

    it('should cleanup orphaned temporary messages', async () => {
      const orphanedMsg = createMockMessage({ id: 'orphan-1', tempId: 'temp-orphan' });
      const activeMsg = createMockMessage({ id: 'active-1', tempId: 'temp-active' });

      await dbOps.upsertMessage(orphanedMsg);
      await dbOps.upsertMessage(activeMsg);

      // Create send request for active message only
      await dbOps.createSendMessageRequest({
        message_id: activeMsg.id,
        status: 'pending',
        retry_count: 0,
        last_sent_at: undefined,
        error_message: undefined,
      });

      const deletedCount = await dbOps.cleanupOrphanedTemporaryMessages();

      expect(deletedCount).toBe(1);

      const orphanStillExists = await dbOps.getMessageByTempId('temp-orphan');
      expect(orphanStillExists).toBeUndefined();

      const activeStillExists = await dbOps.getMessageByTempId('temp-active');
      expect(activeStillExists).toBeDefined();
    });

    it('should get temporary message statistics', async () => {
      const sendingMsg = createMockMessage({ tempId: 'temp-1', status: 'sending' });
      const failedMsg = createMockMessage({ tempId: 'temp-2', status: 'failed' });
      const normalMsg = createMockMessage({ status: 'sent' }); // No tempId

      await dbOps.upsertMessage(sendingMsg);
      await dbOps.upsertMessage(failedMsg);
      await dbOps.upsertMessage(normalMsg);

      const stats = await dbOps.getTemporaryMessageStats();

      expect(stats.total).toBe(2);
      expect(stats.sending).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.oldestAge).toBeGreaterThan(0);
    });
  });

  describe('Clear All Data', () => {
    it('should clear all data from all tables', async () => {
      // Add data to all tables
      const user = createMockUser();
      const conversation = createMockConversation();
      const message = createMockMessage({ conversation_id: conversation.id });
      const draft = createMockDraft();

      await dbOps.upsertUser(user);
      await dbOps.upsertConversation(conversation);
      await dbOps.upsertMessage(message);
      await dbOps.saveDraftMessage({
        conversation_id: draft.conversation_id,
        user_id: draft.user_id,
        content: draft.content,
      });
      await dbOps.addConversationParticipant({
        conversation_id: conversation.id,
        user_id: user.id,
      });
      await dbOps.createSendMessageRequest({
        message_id: message.id,
        status: 'pending',
        retry_count: 0,
        last_sent_at: undefined,
        error_message: undefined,
      });

      await dbOps.clearAllData();

      // Verify all tables are empty
      const users = await dbOps.db.users.toArray();
      const conversations = await dbOps.db.conversations.toArray();
      const messages = await dbOps.db.messages.toArray();
      const drafts = await dbOps.db.draft_messages.toArray();
      const participants = await dbOps.db.conversation_participants.toArray();
      const requests = await dbOps.db.send_message_requests.toArray();

      expect(users).toHaveLength(0);
      expect(conversations).toHaveLength(0);
      expect(messages).toHaveLength(0);
      expect(drafts).toHaveLength(0);
      expect(participants).toHaveLength(0);
      expect(requests).toHaveLength(0);
    });
  });
});
