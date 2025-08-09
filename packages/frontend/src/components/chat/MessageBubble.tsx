import type { UIMessage } from "@/types/chat";
import { MessageStatus } from "./MessageStatus";

interface MessageBubbleProps {
  message: UIMessage;
  isOwn: boolean;
  showAvatar?: boolean;
  onRetryMessage?: (messageId: string) => void;
}

function formatMessageTime(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export const MessageBubble = ({
  message,
  isOwn,
  showAvatar = true,
  onRetryMessage,
}: MessageBubbleProps) => {
  return (
    <div
      className={`flex gap-3 mb-4 ${isOwn ? "flex-row-reverse" : "flex-row"}`}
    >
      {/* Avatar */}
      {showAvatar && !isOwn && (
        <div className="flex-shrink-0">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200">
            {message.sender.profile_picture_url ||
            message.sender.profile_picture_url ? (
              <img
                src={
                  message.sender.profile_picture_url ||
                  message.sender.profile_picture_url
                }
                alt={message.sender.name || message.sender.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white text-sm font-medium">
                {(message.sender.name || message.sender.name || "U")
                  .charAt(0)
                  .toUpperCase()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Message Content */}
      <div
        className={`flex flex-col max-w-xs lg:max-w-md ${
          isOwn ? "items-end" : "items-start"
        }`}
      >
        {/* Message bubble */}
        <div
          className={`px-4 py-2 rounded-2xl break-words ${
            isOwn
              ? "bg-blue-500 text-white rounded-br-md"
              : "bg-gray-100 text-gray-900 rounded-bl-md"
          }`}
        >
          <p className="text-sm leading-relaxed">{message.content}</p>
        </div>

        {/* Message metadata */}
        <div
          className={`flex items-center gap-1 mt-1 px-1 ${
            isOwn ? "flex-row-reverse" : "flex-row"
          }`}
        >
          <span className="text-xs text-gray-500">
            {formatMessageTime(message.created_at)}
          </span>

          {/* Message status (only for own messages) */}
          {isOwn && (
            <MessageStatus message={message} onRetry={onRetryMessage} />
          )}
        </div>
      </div>
    </div>
  );
};
