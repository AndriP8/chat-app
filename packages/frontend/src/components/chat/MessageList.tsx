import { useCallback, useEffect, useRef, useState } from 'react';
import { webSocketService } from '@/services/websocket';
import type { UIMessage } from '@/types/chat';
import { useAuth } from '../auth/AuthContext';
import { MessageBubble } from './MessageBubble';
import { ScrollToBottomButton } from './ScrollToBottomButton';

interface MessageListProps {
  messages: UIMessage[];
  isLoading?: boolean;
  conversationId?: string;
}

const SCROLL_THRESHOLD = 300; // pixels from bottom to consider "at bottom"

export const MessageList = ({ messages, isLoading = false, conversationId }: MessageListProps) => {
  const { currentUser } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const previousMessagesLengthRef = useRef(messages.length);
  const previousScrollHeightRef = useRef(0);
  const isInitialLoadRef = useRef(true);
  const isScrollingRef = useRef(false);
  const hasInitializedConversationRef = useRef<string | null>(null);

  const checkIfAtBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return false;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    return distanceFromBottom < SCROLL_THRESHOLD;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const container = containerRef.current;
    if (!container) return;

    const targetScrollTop = container.scrollHeight - container.clientHeight;

    if (behavior === 'instant') {
      container.scrollTop = targetScrollTop;
      return;
    }

    isScrollingRef.current = true;
    const startScrollTop = container.scrollTop;
    const distance = targetScrollTop - startScrollTop;
    const duration = 500;
    let startTime: number | null = null;

    const animateScroll = (currentTime: number) => {
      if (startTime === null) startTime = currentTime;
      const timeElapsed = currentTime - startTime;
      const progress = Math.min(timeElapsed / duration, 1);
      const easeOutCubic = 1 - (1 - progress) ** 3;

      container.scrollTop = startScrollTop + distance * easeOutCubic;

      if (progress < 1) {
        requestAnimationFrame(animateScroll);
      } else {
        isScrollingRef.current = false;
      }
    };

    requestAnimationFrame(animateScroll);
  }, []);

  const handleScroll = useCallback(() => {
    if (isInitialLoadRef.current) return;
    const atBottom = checkIfAtBottom();
    setShowScrollButton(!atBottom);
  }, [checkIfAtBottom]);

  const handleScrollToBottomClick = useCallback(() => {
    scrollToBottom('smooth');
    setShowScrollButton(false);
  }, [scrollToBottom]);

  // Handle auto scroll on conversation change
  useEffect(() => {
    if (!conversationId) return;

    const isNewConversation = hasInitializedConversationRef.current !== conversationId;

    if (isNewConversation) {
      hasInitializedConversationRef.current = conversationId;
      isInitialLoadRef.current = true;

      requestAnimationFrame(() => {
        if (containerRef.current) {
          scrollToBottom('instant');
          setShowScrollButton(false);
          previousScrollHeightRef.current = containerRef.current.scrollHeight;
          previousMessagesLengthRef.current = messages.length;
        }
      });

      const timer = setTimeout(() => {
        isInitialLoadRef.current = false;
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [conversationId, scrollToBottom, messages.length]);

  // Handle auto scroll on new messages and maintaining scroll position when not at bottom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const hasNewMessages = messages.length > previousMessagesLengthRef.current;

    if (hasNewMessages) {
      if (isScrollingRef.current) {
        previousMessagesLengthRef.current = messages.length;
        requestAnimationFrame(() => {
          previousScrollHeightRef.current = container.scrollHeight;
        });
        return;
      }

      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      const currentlyAtBottom = distanceFromBottom < SCROLL_THRESHOLD;

      const previousScrollHeight = previousScrollHeightRef.current;
      const previousScrollTop = scrollTop;

      previousMessagesLengthRef.current = messages.length;

      requestAnimationFrame(() => {
        const currentScrollHeight = container.scrollHeight;
        const heightDifference = currentScrollHeight - previousScrollHeight;

        if (currentlyAtBottom) {
          scrollToBottom('smooth');
        } else if (heightDifference > 0) {
          container.scrollTop = previousScrollTop + heightDifference;
        }

        previousScrollHeightRef.current = currentScrollHeight;
      });
    } else {
      previousMessagesLengthRef.current = messages.length;
      previousScrollHeightRef.current = container.scrollHeight;
    }
  }, [messages, scrollToBottom]);

  // Mark messages as read when they are displayed
  useEffect(() => {
    if (!conversationId || !currentUser || messages.length === 0) return;

    const unreadMessages = messages.filter(
      (message) => message.sender_id !== currentUser.id && message.status !== 'read'
    );

    for (const message of unreadMessages) {
      webSocketService.markMessageRead(message.id, conversationId);
    }
  }, [messages, currentUser, conversationId]);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex items-center gap-2 text-gray-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
          <span>Loading messages...</span>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center text-gray-500">
          <p className="mb-2 text-lg">No messages yet</p>
          <p className="text-sm">Start the conversation by sending a message!</p>
        </div>
      </div>
    );
  }
  return (
    <div className="relative flex-1">
      <div
        ref={containerRef}
        className="absolute inset-0 space-y-1 overflow-y-auto p-4"
        onScroll={handleScroll}
      >
        {messages.map((message, index) => {
          const isOwn = message.sender_id === currentUser?.id;
          const prevMessage = index > 0 ? messages[index - 1] : null;
          const showAvatar = !prevMessage || prevMessage.sender_id !== message.sender_id;

          return (
            <MessageBubble
              key={message.id}
              message={message}
              isOwn={isOwn}
              showAvatar={showAvatar}
            />
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {showScrollButton && <ScrollToBottomButton onClick={handleScrollToBottomClick} />}
    </div>
  );
};
