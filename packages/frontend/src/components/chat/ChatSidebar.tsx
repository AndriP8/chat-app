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
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0];

        if (latestMessage) {
          return {
            ...room,
            lastMessage: {
              id: latestMessage.id,
              content: latestMessage.content,
              senderId: latestMessage.senderId,
              conversationId: latestMessage.conversationId,
              status: latestMessage.status,
              createdAt: latestMessage.createdAt,
              updatedAt: latestMessage.updatedAt,
              sender: latestMessage.sender,
            },
            updatedAt: new Date(latestMessage.createdAt).toISOString(),
          };
        }
      }
      return room;
    });
  }, [rooms, messages]);
  const sortedRooms = useMemo(() => {
    return [...roomsWithLatestMessages].sort((a, b) => {
      const aTime = a.lastMessage
        ? new Date(a.lastMessage.createdAt).getTime()
        : new Date(a.updatedAt).getTime();
      const bTime = b.lastMessage
        ? new Date(b.lastMessage.createdAt).getTime()
        : new Date(b.updatedAt).getTime();
      return bTime - aTime;
    });
  }, [roomsWithLatestMessages]);

  return (
    <div className="flex h-full w-full flex-col border-gray-200 border-r bg-white dark:border-gray-700 dark:bg-gray-800">
      {/* Header */}
      <div className="border-gray-200 border-b p-4 dark:border-gray-700">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="font-semibold text-gray-900 text-xl dark:text-white">Messages</h1>
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
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
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
