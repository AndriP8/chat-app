import { Check, CheckCheck, Clock, AlertCircle, RotateCcw } from "lucide-react";
import type { UIMessage } from "@/types/chat";

interface MessageStatusProps {
  message: UIMessage;
  onRetry?: (messageId: string) => void;
}

export const MessageStatus = ({ message, onRetry }: MessageStatusProps) => {
  if (message.sender_id !== "current-user") {
    return null;
  }

  if (message.isTemporary) {
    switch (message.sendingStatus) {
      case "sending":
        return (
          <div className="flex items-center gap-1 text-gray-400 text-xs">
            <Clock size={12} className="animate-pulse" />
            <span>Sending...</span>
          </div>
        );
      case "failed":
        return (
          <div className="flex items-center gap-2 text-red-500 text-xs">
            <AlertCircle size={12} />
            <span>Failed to send</span>
            {onRetry && (
              <button
                type="button"
                onClick={() => onRetry(message.id)}
                className="flex items-center gap-1 text-blue-500 hover:text-blue-600 transition-colors"
                title="Retry sending message"
              >
                <RotateCcw size={12} />
                <span>Retry</span>
              </button>
            )}
          </div>
        );
      case "sent":
        return (
          <div className="flex items-center gap-1 text-green-500 text-xs">
            <Check size={12} />
            <span>Sent</span>
          </div>
        );
      default:
        return null;
    }
  }

  switch (message.status) {
    case "sent":
      return (
        <div className="flex items-center text-gray-400">
          <Check size={12} />
        </div>
      );
    case "delivered":
      return (
        <div className="flex items-center text-gray-500">
          <CheckCheck size={12} />
        </div>
      );
    case "read":
      return (
        <div className="flex items-center text-blue-500">
          <CheckCheck size={12} />
        </div>
      );
    default:
      return null;
  }
};
