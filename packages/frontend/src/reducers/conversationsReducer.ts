import type { ConversationsState, ConversationsAction } from '@/types/chat';

export const initialConversationsState: ConversationsState = {
  conversations: [],
  messages: {},
  hasMore: true,
  loading: {
    conversations: false,
    messages: {},
    send: false,
    create: false,
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

    default:
      return state;
  }
}
