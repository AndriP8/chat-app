import { SendHorizonal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { draftMessageService } from '@/services/draftMessageService';
import { webSocketService } from '@/services/websocket';
import { useAuth } from '../auth/AuthContext';

interface MessageInputProps {
  onSendMessage: (content: string) => void;
  placeholder?: string;
  conversationId?: string;
}

export const MessageInput = ({
  onSendMessage,
  placeholder = 'Type a message...',
  conversationId,
}: MessageInputProps) => {
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { currentUser } = useAuth();

  useEffect(() => {
    if (!conversationId || !currentUser?.id) return;
    const loadDraft = async () => {
      try {
        const draft = await draftMessageService.getDraft(conversationId, currentUser.id);
        if (draft) {
          setMessage(draft.content);
        } else {
          setMessage('');
        }
      } catch (error) {
        console.error('Failed to load draft message:', error);
      }
    };

    loadDraft();
  }, [conversationId, currentUser?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedMessage = message.trim();

    if (trimmedMessage && conversationId && currentUser?.id) {
      onSendMessage(trimmedMessage);

      // Stop typing indicator
      if (conversationId && isTyping) {
        webSocketService.sendTypingStop(conversationId);
        setIsTyping(false);
      }

      try {
        await draftMessageService.deleteDraft(conversationId, currentUser.id);
      } catch (error) {
        console.error('Failed to delete draft message:', error);
      }

      setMessage('');

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const previousValue = message;
    setMessage(newValue);

    // Handle typing indicator
    if (conversationId) {
      // Start typing if transitioning from empty to non-empty
      if (newValue.trim() && !previousValue.trim() && !isTyping) {
        webSocketService.sendTypingStart(conversationId);
        setIsTyping(true);
      }

      // Stop typing if input becomes empty
      if (!newValue.trim() && isTyping) {
        webSocketService.sendTypingStop(conversationId);
        setIsTyping(false);
      }

      // Auto-stop typing after 3 seconds of inactivity
      if (newValue.trim() && isTyping) {
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
          webSocketService.sendTypingStop(conversationId);
          setIsTyping(false);
        }, 3000);
      }
    }

    // Save draft with debouncing
    if (conversationId && currentUser?.id) {
      draftMessageService.saveDraftDebounced(conversationId, currentUser.id, newValue);
    }
  };

  const handleBlur = async () => {
    // Stop typing indicator on blur
    if (conversationId && isTyping) {
      webSocketService.sendTypingStop(conversationId);
      setIsTyping(false);
    }

    if (conversationId && currentUser?.id) {
      try {
        await draftMessageService.saveDraftOnBlur(conversationId, currentUser.id, message);
      } catch (error) {
        console.error('Failed to save draft on blur:', error);
      }
    }
  };

  // Cleanup on unmount or conversation change
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (conversationId && isTyping) {
        webSocketService.sendTypingStop(conversationId);
      }
    };
  }, [conversationId, isTyping]);

  return (
    <div className="sticky bottom-0 border-gray-200 border-t bg-white p-2 sm:p-3 md:p-4 dark:border-gray-700 dark:bg-gray-800">
      <form onSubmit={handleSubmit} className="flex items-center gap-2 sm:gap-3">
        {/* Message input */}
        <textarea
          id="message_content"
          ref={textareaRef}
          value={message}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="field-sizing-content w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 pr-12 text-gray-900 placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
          style={{ minHeight: '48px', maxHeight: '420px' }}
        />

        {/* Send button */}
        <button
          type="submit"
          disabled={!message.trim()}
          className="shrink-0 rounded-full bg-blue-500 p-3 text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Send message"
        >
          <SendHorizonal size={18} />
        </button>
      </form>
    </div>
  );
};
