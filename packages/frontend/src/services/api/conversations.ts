import { makeRequest } from './base';
import type {
  Message,
  GetMessagesQuery,
  ConversationsResponse,
  MessagesResponse,
} from '@/types/chat';

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
  ): Promise<{ messages: Message[]; hasMore: boolean }> => {
    const searchParams = new URLSearchParams();

    if (query.limit) {
      searchParams.append('limit', query.limit.toString());
    }
    if (query.before) {
      searchParams.append('before', query.before);
    }

    const queryString = searchParams.toString();
    const endpoint = `/conversations/${conversationId}/messages${
      queryString ? `?${queryString}` : ''
    }`;

    const response = await makeRequest<MessagesResponse>(endpoint);
    return {
      messages: response.data,
      hasMore: response.hasMore,
    };
  },
};

export default conversationApi;
