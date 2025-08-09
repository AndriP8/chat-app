import type { ChatRoom } from "@/types/chat";

interface ChatHeaderProps {
  room: ChatRoom;
}

export const ChatHeader = ({ room }: ChatHeaderProps) => {
  const displayName = room.participants[0]?.name || "Unknown";
  const avatar = room.participants[0]?.profile_picture_url;

  return (
    <div className="p-4 bg-white border-b border-gray-200 flex items-center justify-between">
      {/* Left side - Avatar and info */}
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200">
            {avatar ? (
              <img
                src={avatar}
                alt={displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white font-medium">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {/* Name and status */}
        <div>
          <h2 className="font-semibold text-gray-900">{displayName}</h2>
        </div>
      </div>
    </div>
  );
};
