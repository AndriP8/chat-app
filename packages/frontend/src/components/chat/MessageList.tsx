import { useEffect, useRef } from "react";
import type { UIMessage } from "@/types/chat";
import { MessageBubble } from "./MessageBubble";

interface MessageListProps {
  messages: UIMessage[];
  currentUserId: string;
  isLoading?: boolean;
  onRetryMessage?: (messageId: string) => void;
}

export const MessageList = ({
  messages,
  currentUserId,
  isLoading = false,
  onRetryMessage,
}: MessageListProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  });

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
          <p className="text-sm">
            Start the conversation by sending a message!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-1">
      {messages.map((message, index) => {
        const isOwn = message.senderId === currentUserId;
        const prevMessage = index > 0 ? messages[index - 1] : null;
        const showAvatar =
          !prevMessage || prevMessage.senderId !== message.senderId;

        return (
          <MessageBubble
            key={message.id}
            message={message}
            isOwn={isOwn}
            showAvatar={showAvatar}
            onRetryMessage={onRetryMessage}
          />
        );
      })}

      {/* Invisible element to scroll to */}
      <div ref={messagesEndRef} />
    </div>
  );
};
