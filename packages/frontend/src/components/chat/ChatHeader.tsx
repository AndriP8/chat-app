import type { ChatRoom } from '@/types/chat';
import { useAuth } from '../auth/AuthContext';

interface ChatHeaderProps {
  room: ChatRoom;
}

export const ChatHeader = ({ room }: ChatHeaderProps) => {
  const { currentUser } = useAuth();
  const recipientParticipant = room.participants.find(
    (participant) => participant.id !== currentUser?.id
  );
  const displayName = recipientParticipant?.name || 'Unknown';
  const avatar = recipientParticipant?.profilePictureUrl;

  return (
    <div className="flex items-center justify-between border-gray-200 border-b bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      {/* Left side - Avatar and info */}
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="h-10 w-10 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-600">
            {avatar ? (
              <img src={avatar} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-gray-400 to-gray-600 font-medium text-white">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {/* Name and status */}
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white">{displayName}</h2>
        </div>
      </div>
    </div>
  );
};
