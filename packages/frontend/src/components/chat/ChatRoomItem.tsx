import type { ChatRoom } from "@/types/chat";
import { formatMessageTime } from "@/utils/helpers";
import { useAuth } from "@/components/auth/AuthContext";

interface ChatRoomItemProps {
  room: ChatRoom;
  isSelected: boolean;
  onClick: () => void;
}

export const ChatRoomItem = ({
  room,
  isSelected,
  onClick,
}: ChatRoomItemProps) => {
  const { currentUser } = useAuth();

  if (!currentUser) {
    return null;
  }

  const otherParticipant = room.participants.find(
    (participant) => participant.id !== currentUser.id,
  );
  const displayName = otherParticipant?.name || "Unknown";
  const avatar = otherParticipant?.profile_picture_url;

  const lastMessage = room.last_message;
  const lastMessageTime = lastMessage
    ? formatMessageTime(new Date(lastMessage.created_at))
    : "";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full p-3 text-left hover:bg-gray-50 transition-colors border-l-4 ${
        isSelected
          ? "bg-blue-50 border-blue-500"
          : "border-transparent hover:border-gray-200"
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200">
            {avatar ? (
              <img
                src={avatar}
                alt={displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium text-lg">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-medium text-gray-900 truncate">
              {displayName}
            </h3>
            {lastMessageTime && (
              <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                {lastMessageTime}
              </span>
            )}
          </div>

          {/* Last message */}
          {lastMessage && (
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-600 truncate flex-1">
                {lastMessage.sender_id === room.participants[0]?.id
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
