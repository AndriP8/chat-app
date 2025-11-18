import type {
  ConversationsResponse,
  GetMessagesQuery,
  Message,
  MessagesResponse,
} from '@/types/chat';
import { makeRequest } from './base';

export const conversationApi = {
  // Get all conversations for the current user
  getConversations: async (): Promise<ConversationsResponse> => {
    const response = await makeRequest<ConversationsResponse>('/conversations');
    return response;
  },

  // Get messages for a specific conversation
  getMessages: async (
    conversationId: string,
    query: GetMessagesQuery = {}
  ): Promise<{ messages: Message[]; hasMore: boolean; nextCursor: string | null }> => {
    const searchParams = new URLSearchParams();

    if (query.limit) {
      searchParams.append('limit', query.limit.toString());
    }
    if (query.next_cursor) {
      searchParams.append('next_cursor', query.next_cursor);
    }

    const queryString = searchParams.toString();
    const endpoint = `/conversations/${conversationId}/messages${
      queryString ? `?${queryString}` : ''
    }`;

    const response = await makeRequest<MessagesResponse>(endpoint);
    return {
      messages: response.data,
      hasMore: response.hasMore,
      nextCursor: response.next_cursor,
    };
  },
};

export default conversationApi;
