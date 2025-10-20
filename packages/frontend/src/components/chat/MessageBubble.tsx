import type { UIMessage } from '@/types/chat';
import { Check, CheckCheck, AlertCircle, Clock, RotateCcw } from 'lucide-react';

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
        return <Clock size={12} className="text-gray-400 animate-pulse" />;
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
    <div className={`flex gap-3 mb-4 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar or placeholder for alignment */}
      {!isOwn && (
        <div className="flex-shrink-0">
          {showAvatar ? (
            <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200">
              {message.sender.profile_picture_url || message.sender.profile_picture_url ? (
                <img
                  src={message.sender.profile_picture_url || message.sender.profile_picture_url}
                  alt={message.sender.name || message.sender.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white text-sm font-medium">
                  {message.sender.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          ) : (
            // Invisible placeholder to maintain alignment
            <div className="w-8 h-8" />
          )}
        </div>
      )}

      {/* Message Content */}
      <div className={`flex flex-col max-w-xs lg:max-w-md ${isOwn ? 'items-end' : 'items-start'}`}>
        {/* Message bubble */}
        <div
          className={`px-4 py-2 rounded-2xl wrap-anywhere ${
            isOwn
              ? 'bg-blue-500 text-white rounded-br-md'
              : 'bg-gray-100 text-gray-900 rounded-bl-md'
          } ${message.status === 'failed' ? 'border border-red-200' : ''}`}
        >
          <p className="text-sm leading-relaxed">{message.content}</p>
        </div>

        {/* Message metadata */}
        <div
          className={`flex items-center gap-1 mt-1 px-1 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
        >
          <span className="text-xs text-gray-500">{formatMessageTime(message.created_at)}</span>
          {renderStatusIcon()}
        </div>
      </div>
    </div>
  );
};
