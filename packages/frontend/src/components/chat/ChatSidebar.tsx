import { useMemo } from 'react';
import type { ChatRoom, UIMessage } from '@/types/chat';
import { ChatRoomItem } from './ChatRoomItem';

interface ChatSidebarProps {
  rooms: ChatRoom[];
  currentRoom: ChatRoom | null;
  onRoomSelect: (room: ChatRoom) => void;
  isLoading: boolean;
  messages: Record<string, UIMessage[]>;
}

export const ChatSidebar = ({
  rooms,
  currentRoom,
  onRoomSelect,
  isLoading,
  messages,
}: ChatSidebarProps) => {
  const roomsWithLatestMessages = useMemo(() => {
    return rooms.map((room) => {
      const roomMessages = messages[room.id];
      if (roomMessages && roomMessages.length > 0) {
        const latestMessage = [...roomMessages].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];

        if (latestMessage) {
          return {
            ...room,
            last_message: {
              id: latestMessage.id,
              content: latestMessage.content,
              sender_id: latestMessage.sender_id,
              conversation_id: latestMessage.conversation_id,
              status: latestMessage.status,
              created_at: latestMessage.created_at,
              updated_at: latestMessage.updated_at,
              sender: latestMessage.sender,
            },
            updated_at: latestMessage.created_at.toISOString(),
          };
        }
      }
      return room;
    });
  }, [rooms, messages]);
  const sortedRooms = useMemo(() => {
    return [...roomsWithLatestMessages].sort((a, b) => {
      const aTime = a.last_message
        ? new Date(a.last_message.created_at).getTime()
        : new Date(a.updated_at).getTime();
      const bTime = b.last_message
        ? new Date(b.last_message.created_at).getTime()
        : new Date(b.updated_at).getTime();
      return bTime - aTime;
    });
  }, [roomsWithLatestMessages]);

  return (
    <div className="flex h-full w-80 flex-col border-gray-200 border-r bg-white">
      {/* Header */}
      <div className="border-gray-200 border-b p-4">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="font-semibold text-gray-900 text-xl">Messages</h1>
        </div>
      </div>
      {isLoading && (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
        </div>
      )}
      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {!isLoading && sortedRooms.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <p>No conversations yet</p>
          </div>
        ) : (
          <div className="py-2">
            {sortedRooms.map((room) => (
              <ChatRoomItem
                key={room.id}
                room={room}
                isSelected={currentRoom?.id === room.id}
                onClick={() => onRoomSelect(room)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
