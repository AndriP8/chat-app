import { useState, useCallback } from "react";
import { MessageCircle } from "lucide-react";
import { ChatSidebar } from "./ChatSidebar";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { useConversations } from "@/hooks/useConversations";
import type { ChatRoom } from "@/types/chat";

export default function ChatPage() {
  const [currentRoom, setCurrentRoom] = useState<ChatRoom | null>(null);
  const { conversations, messages, isLoading, errors } = useConversations();

  const handleRoomSelect = useCallback(async (room: ChatRoom) => {
    setCurrentRoom(room);
  }, []);

  const handleSendMessage = useCallback(async () => {
    if (!currentRoom) return;
  }, [currentRoom]);

  const handleRetryMessage = useCallback(async () => {
    if (!currentRoom) return;
  }, [currentRoom]);

  const currentMessages = currentRoom ? messages[currentRoom.id] || [] : [];

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Sidebar */}
      <ChatSidebar
        rooms={conversations}
        currentRoom={currentRoom}
        onRoomSelect={handleRoomSelect}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Error Display */}
        {Object.keys(errors?.messages || {}).length > 0 && currentRoom?.id && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 mx-4 mt-4 rounded">
            <p className="text-sm">{errors?.messages?.[currentRoom.id]}</p>
          </div>
        )}

        {currentRoom ? (
          <>
            {/* Chat Header */}
            <ChatHeader room={currentRoom} />

            {/* Messages */}
            <MessageList
              messages={currentMessages}
              currentUserId="current-user"
              isLoading={isLoading}
              onRetryMessage={handleRetryMessage}
            />

            {/* Message Input */}
            <MessageInput
              onSendMessage={handleSendMessage}
              disabled={isLoading}
            />
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <MessageCircle size={64} className="mx-auto mb-4 text-gray-300" />
              <h2 className="text-xl font-semibold mb-2">Welcome to Chat</h2>
              <p>Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
