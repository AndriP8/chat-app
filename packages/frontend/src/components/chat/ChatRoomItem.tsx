import { useAuth } from '@/components/auth/AuthContext';
import type { ChatRoom } from '@/types/chat';
import { formatMessageTime } from '@/utils/helpers';

interface ChatRoomItemProps {
  room: ChatRoom;
  isSelected: boolean;
  onClick: () => void;
}

export const ChatRoomItem = ({ room, isSelected, onClick }: ChatRoomItemProps) => {
  const { currentUser } = useAuth();

  if (!currentUser) {
    return null;
  }

  const chatPartner = room.participants.find((participant) => participant.id !== currentUser.id);
  const displayName = chatPartner?.name || 'Unknown';
  const avatar = chatPartner?.profilePictureUrl;

  const lastMessage = room.lastMessage;
  const lastMessageTime = lastMessage ? formatMessageTime(new Date(lastMessage.createdAt)) : '';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full border-l-4 p-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 ${
        isSelected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : 'border-transparent hover:border-gray-200 dark:hover:border-gray-600'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="h-12 w-12 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-600">
            {avatar ? (
              <img src={avatar} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-blue-500 to-purple-600 font-medium text-lg text-white">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Header */}
          <div className="mb-1 flex items-center justify-between">
            <h3 className="truncate font-medium text-gray-900 dark:text-white">{displayName}</h3>
            {lastMessageTime && (
              <span className="ml-2 shrink-0 text-gray-500 text-xs dark:text-gray-400">
                {lastMessageTime}
              </span>
            )}
          </div>

          {/* Last message */}
          {lastMessage && (
            <div className="flex items-center gap-2">
              <p className="flex-1 truncate text-gray-600 text-sm dark:text-gray-400">
                {room.participants.some((participant) => participant.id === lastMessage.senderId)
                  ? lastMessage.content
                  : `You: ${lastMessage.content}`}
              </p>
            </div>
          )}
        </div>
      </div>
    </button>
  );
};
