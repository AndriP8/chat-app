import { useEffect, useRef } from 'react';
import type { UIMessage } from '@/types/chat';
import { MessageBubble } from './MessageBubble';
import { useAuth } from '../auth/AuthContext';
import { webSocketService } from '@/services/websocket';

interface MessageListProps {
  messages: UIMessage[];
  isLoading?: boolean;
  conversationId?: string;
}

export const MessageList = ({ messages, isLoading = false, conversationId }: MessageListProps) => {
  const { currentUser } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  });

  // Mark messages as read when they are displayed
  useEffect(() => {
    if (!conversationId || !currentUser || messages.length === 0) return;

    const unreadMessages = messages.filter(
      (message) =>
        message.sender_id !== currentUser.id &&
        message.status !== 'read'
    );

    // Mark each unread message as read
    for (const message of unreadMessages) {
      webSocketService.markMessageRead(message.id, conversationId);
    }
  }, [messages, currentUser, conversationId]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-500">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          <span>Loading messages...</span>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <p className="text-lg mb-2">No messages yet</p>
          <p className="text-sm">Start the conversation by sending a message!</p>
        </div>
      </div>
    );
  }
  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-1">
      {messages.map((message, index) => {
        const isOwn = message.sender_id === currentUser?.id;
        const prevMessage = index > 0 ? messages[index - 1] : null;
        const showAvatar = !prevMessage || prevMessage.sender_id !== message.sender_id;

        return (
          <MessageBubble key={message.id} message={message} isOwn={isOwn} showAvatar={showAvatar} />
        );
      })}

      {/* Invisible element to scroll to */}
      <div ref={messagesEndRef} />
    </div>
  );
};
