import { AlertCircle, Check, CheckCheck, Clock, RotateCcw } from 'lucide-react';
import type { UIMessage } from '@/types/chat';

interface MessageBubbleProps {
  message: UIMessage;
  isOwn: boolean;
  showAvatar?: boolean;
}

function formatMessageTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const MessageBubble = ({ message, isOwn, showAvatar = true }: MessageBubbleProps) => {
  const renderStatusIcon = () => {
    if (!isOwn) return null;
    switch (message.status) {
      case 'sending':
        return <Clock size={12} className="animate-pulse text-gray-400" />;
      case 'sent':
        return <Check size={12} className="text-gray-500" />;
      case 'delivered':
        return <CheckCheck size={12} className="text-gray-500" />;
      case 'read':
        return <CheckCheck size={12} className="text-blue-600" />;
      case 'failed':
        return (
          <div className="flex items-center gap-1" title="Message failed to send">
            <AlertCircle size={12} className="text-red-500" />
            {message.retryCount && message.retryCount > 0 && (
              <RotateCcw size={10} className="text-red-400" />
            )}
          </div>
        );
      default:
        return <Check size={12} className="text-gray-400" />;
    }
  };
  return (
    <div className={`mb-4 flex gap-3 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar or placeholder for alignment */}
      {!isOwn && (
        <div className="shrink-0">
          {showAvatar ? (
            <div className="h-8 w-8 overflow-hidden rounded-full bg-gray-200">
              {message.sender.profilePictureUrl || message.sender.profilePictureUrl ? (
                <img
                  src={message.sender.profilePictureUrl || message.sender.profilePictureUrl}
                  alt={message.sender.name || message.sender.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-gray-400 to-gray-600 font-medium text-sm text-white">
                  {message.sender.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          ) : (
            // Invisible placeholder to maintain alignment
            <div className="h-8 w-8" />
          )}
        </div>
      )}

      {/* Message Content */}
      <div className={`flex max-w-xs flex-col lg:max-w-md ${isOwn ? 'items-end' : 'items-start'}`}>
        {/* Message bubble */}
        <div
          className={`wrap-anywhere rounded-2xl px-4 py-2 ${
            isOwn
              ? 'rounded-br-md bg-blue-500 text-white'
              : 'rounded-bl-md bg-gray-100 text-gray-900'
          } ${message.status === 'failed' ? 'border border-red-200' : ''}`}
        >
          <p className="text-sm leading-relaxed">{message.content}</p>
        </div>

        {/* Message metadata */}
        <div
          className={`mt-1 flex items-center gap-1 px-1 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
        >
          <span className="text-gray-500 text-xs">{formatMessageTime(message.createdAt)}</span>
          {renderStatusIcon()}
        </div>
      </div>
    </div>
  );
};
