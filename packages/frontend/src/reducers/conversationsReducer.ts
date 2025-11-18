import type { ConversationsAction, ConversationsState } from '@/types/chat';

export const initialConversationsState: ConversationsState = {
  conversations: [],
  messages: {},
  hasMore: true,
  loading: {
    conversations: false,
    messages: {},
    loadingMore: {},
  },
  pagination: {
    hasMore: {},
  },
  errors: {},
};

export function conversationsReducer(
  state: ConversationsState,
  action: ConversationsAction
): ConversationsState {
  switch (action.type) {
    case 'SET_CONVERSATIONS':
      return {
        ...state,
        conversations: action.payload,
      };

    case 'SET_MESSAGES':
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.payload.conversationId]: action.payload.messages,
        },
        pagination: {
          ...state.pagination,
          hasMore: {
            ...state.pagination.hasMore,
            [action.payload.conversationId]: action.payload.hasMore,
          },
        },
      };

    case 'ADD_MESSAGE': {
      const { conversationId, message } = action.payload;
      return {
        ...state,
        messages: {
          ...state.messages,
          [conversationId]: [...(state.messages[conversationId] || []), message],
        },
      };
    }

    case 'UPDATE_MESSAGE': {
      const { conversationId, messageId, updates } = action.payload;
      const conversationMessages = state.messages[conversationId] || [];

      return {
        ...state,
        messages: {
          ...state.messages,
          [conversationId]: conversationMessages.map((msg) =>
            msg.id === messageId ? { ...msg, ...updates } : msg
          ),
        },
      };
    }

    case 'SET_LOADING': {
      const { type, loading, conversationId } = action.payload;

      if (type === 'messages' && conversationId) {
        return {
          ...state,
          loading: {
            ...state.loading,
            messages: {
              ...state.loading.messages,
              [conversationId]: loading,
            },
          },
        };
      }

      return {
        ...state,
        loading: {
          ...state.loading,
          [type]: loading,
        },
      };
    }

    case 'SET_ERROR': {
      const { type, error, conversationId } = action.payload;

      if (type === 'messages' && conversationId) {
        const newMessages = { ...state.errors.messages };
        if (error) {
          newMessages[conversationId] = error;
        } else {
          delete newMessages[conversationId];
        }

        return {
          ...state,
          errors: {
            ...state.errors,
            messages: newMessages,
          },
        };
      }

      return {
        ...state,
        errors: {
          ...state.errors,
          [type]: error,
        },
      };
    }

    case 'CLEAR_ERROR': {
      const { type, conversationId } = action.payload;

      if (type === 'messages' && conversationId) {
        const newMessages = { ...state.errors.messages };
        delete newMessages[conversationId];

        return {
          ...state,
          errors: {
            ...state.errors,
            messages: newMessages,
          },
        };
      }

      const newErrors = { ...state.errors };
      delete newErrors[type];

      return {
        ...state,
        errors: newErrors,
      };
    }

    case 'UPDATE_CONVERSATION': {
      const { conversationId, updates } = action.payload;

      return {
        ...state,
        conversations: state.conversations.map((conv) =>
          conv.id === conversationId ? { ...conv, ...updates } : conv
        ),
      };
    }

    case 'REPLACE_TEMP_MESSAGE': {
      const { conversationId, tempId, message } = action.payload;
      const conversationMessages = state.messages[conversationId] || [];

      return {
        ...state,
        messages: {
          ...state.messages,
          [conversationId]: conversationMessages.map((msg) =>
            msg.tempId === tempId || (msg.isTemporary && msg.id === tempId)
              ? { ...message, isTemporary: false }
              : msg
          ),
        },
      };
    }

    case 'REMOVE_TEMP_MESSAGE': {
      const { conversationId, tempId } = action.payload;
      const conversationMessages = state.messages[conversationId] || [];

      return {
        ...state,
        messages: {
          ...state.messages,
          [conversationId]: conversationMessages.filter(
            (msg) => msg.tempId !== tempId && !(msg.isTemporary && msg.id === tempId)
          ),
        },
      };
    }

    case 'LOAD_MORE_MESSAGES_START': {
      const { conversationId } = action.payload;
      return {
        ...state,
        loading: {
          ...state.loading,
          loadingMore: {
            ...state.loading.loadingMore,
            [conversationId]: true,
          },
        },
      };
    }

    case 'LOAD_MORE_MESSAGES_SUCCESS': {
      const { conversationId, messages: newMessages, hasMore } = action.payload;
      const existingMessages = state.messages[conversationId] || [];

      const messageMap = new Map(existingMessages.map((msg) => [msg.id, msg]));
      for (const msg of newMessages) {
        if (!messageMap.has(msg.id)) {
          messageMap.set(msg.id, msg);
        }
      }

      const allMessages = Array.from(messageMap.values()).sort(
        (a, b) => a.created_at.getTime() - b.created_at.getTime()
      );

      return {
        ...state,
        messages: {
          ...state.messages,
          [conversationId]: allMessages,
        },
        pagination: {
          ...state.pagination,
          hasMore: {
            ...state.pagination.hasMore,
            [conversationId]: hasMore,
          },
        },
        loading: {
          ...state.loading,
          loadingMore: {
            ...state.loading.loadingMore,
            [conversationId]: false,
          },
        },
      };
    }

    case 'LOAD_MORE_MESSAGES_FAILURE': {
      const { conversationId, error } = action.payload;
      return {
        ...state,
        loading: {
          ...state.loading,
          loadingMore: {
            ...state.loading.loadingMore,
            [conversationId]: false,
          },
        },
        errors: {
          ...state.errors,
          messages: {
            ...state.errors.messages,
            [conversationId]: error,
          },
        },
      };
    }

    default:
      return state;
  }
}
