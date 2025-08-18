import type { ChatRoom } from '@/types/chat';
import { ChatRoomItem } from './ChatRoomItem';

interface ChatSidebarProps {
  rooms: ChatRoom[];
  currentRoom: ChatRoom | null;
  onRoomSelect: (room: ChatRoom) => void;
  isLoading: boolean;
}

export const ChatSidebar = ({ rooms, currentRoom, onRoomSelect, isLoading }: ChatSidebarProps) => {
  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-gray-900">Messages</h1>
        </div>
      </div>
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
        </div>
      )}
      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {!isLoading && rooms.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <p>No conversations yet</p>
          </div>
        ) : (
          <div className="py-2">
            {rooms.map((room) => (
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
