import { useVirtualizer } from '@tanstack/react-virtual';
import type React from 'react';
import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { webSocketService } from '@/services/websocket';
import type { UIMessage } from '@/types/chat';
import { useAuth } from '../auth/AuthContext';
import { MessageBubble } from './MessageBubble';
import { ScrollToBottomButton } from './ScrollToBottomButton';

type ScrollBehavior = 'auto' | 'smooth';
export interface MessageListHandle {
  scrollToBottom: (behavior?: ScrollBehavior) => void;
}

interface MessageListProps {
  messages: UIMessage[];
  isLoading?: boolean;
  conversationId?: string;
  ref: React.Ref<MessageListHandle>;
}

const SCROLL_THRESHOLD = 300; // pixels from bottom to consider "at bottom"

export const MessageList = ({
  messages,
  isLoading = false,
  conversationId,
  ref,
}: MessageListProps) => {
  const { currentUser } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const prevMessagesLengthRef = useRef(messages.length);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 80,
    overscan: 5,
    onChange: (instance) => {
      const container = containerRef.current;
      if (!container || instance.scrollOffset === null) return;

      const { scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - instance.scrollOffset - clientHeight;
      const atBottom = distanceFromBottom < SCROLL_THRESHOLD;
      setShowScrollButton(!atBottom);
    },
  });

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = 'auto') => {
      if (messages.length > 0) {
        containerRef.current?.scrollTo({
          top: containerRef.current.scrollHeight,
          behavior,
        });
      }
    },
    [messages.length]
  );

  // Expose scrollToBottom method via ref
  useImperativeHandle(
    ref,
    () => ({
      scrollToBottom,
    }),
    [scrollToBottom]
  );

  useEffect(() => {
    // Only scroll to bottom automatically if we open the chat
    if (!messagesEndRef.current) {
      scrollToBottom('auto');
      prevMessagesLengthRef.current = messages.length;
    }
  }, [scrollToBottom, messages.length]);

  // Auto scroll to bottom on new messages only if we were at the bottom before
  useEffect(() => {
    const hasNewMessages = messages.length > prevMessagesLengthRef.current;
    if (hasNewMessages && !showScrollButton) {
      scrollToBottom('auto');
    }
  }, [messages.length, scrollToBottom, showScrollButton]);

  // Mark messages as read when they are displayed (only visible items in virtualizer)
  useEffect(() => {
    if (!conversationId || !currentUser || messages.length === 0) return;
    // TODO: When user scroll to top and receive new message, the new message should mark as read without scroll to bottom and add indicator in scroll to bottom component
    const visibleIndexes = new Set(virtualizer.getVirtualItems().map((item) => item.index));

    // Filter for visible unread messages only
    const unreadMessages = messages.filter(
      (message, index) =>
        visibleIndexes.has(index) &&
        message.sender_id !== currentUser.id &&
        message.status !== 'read'
    );

    for (const message of unreadMessages) {
      webSocketService.markMessageRead(message.id, conversationId);
    }
  }, [messages, currentUser, conversationId, virtualizer]);

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
      <div ref={containerRef} className="absolute inset-0 overflow-y-auto p-4">
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const message = messages[virtualItem.index];
            const isOwn = message.sender_id === currentUser?.id;
            const prevMessage = virtualItem.index > 0 ? messages[virtualItem.index - 1] : null;
            const showAvatar = !prevMessage || prevMessage.sender_id !== message.sender_id;

            return (
              <div
                key={message.id}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                }}
                className="space-y-1"
              >
                <MessageBubble message={message} isOwn={isOwn} showAvatar={showAvatar} />
              </div>
            );
          })}
        </div>

        <div ref={messagesEndRef} />
      </div>

      {showScrollButton && (
        <ScrollToBottomButton
          onClick={() => virtualizer.scrollToIndex(messages.length - 1, { behavior: 'smooth' })}
        />
      )}
    </div>
  );
};
