import { MessageCircle } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { useWebSocketConversations } from '@/hooks/useWebSocketConversations';
import type { ChatRoom } from '@/types/chat';
import { ChatHeader } from './ChatHeader';
import { ChatSidebar } from './ChatSidebar';
import { MessageInput } from './MessageInput';
import { MessageList, type MessageListHandle } from './MessageList';
import { OfflineIndicator } from './OfflineIndicator';

export default function ChatPage() {
  const [currentRoom, setCurrentRoom] = useState<ChatRoom | null>(null);
  const messageListRef = useRef<MessageListHandle>(null);
  const {
    conversations,
    messages,
    loading,
    pagination,
    error,
    loadMessages,
    loadMoreMessages,
    sendMessage,
  } = useWebSocketConversations();

  const handleRoomSelect = useCallback(
    async (room: ChatRoom) => {
      setCurrentRoom(room);

      if (!messages[room.id]) {
        await loadMessages(room.id);
      }
    },
    [loadMessages, messages]
  );

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!currentRoom) return;

      await sendMessage(currentRoom.id, content);

      // Scroll to bottom when user sends a message
      messageListRef.current?.scrollToBottom;
    },
    [currentRoom, sendMessage]
  );
  const currentMessages = currentRoom ? messages[currentRoom.id] || [] : [];

  const handleBackToList = useCallback(() => {
    setCurrentRoom(null);
  }, []);

  return (
    <div className="flex h-[calc(100vh-64px)] bg-gray-50 dark:bg-gray-900">
      {/* Sidebar - Full width on mobile when no chat selected, hidden on mobile when chat selected */}
      <div
        className={`h-full w-full flex-shrink-0 md:w-80 ${
          currentRoom ? 'hidden md:block' : 'block'
        }`}
      >
        <ChatSidebar
          rooms={conversations}
          currentRoom={currentRoom}
          onRoomSelect={handleRoomSelect}
          isLoading={loading.conversations}
          messages={messages}
        />
      </div>

      {/* Main Chat Area - Hidden on mobile when no chat selected, shown when chat selected */}
      <div className={`flex flex-1 flex-col ${currentRoom ? 'flex' : 'hidden md:flex'}`}>
        {/* Offline Indicator */}
        <OfflineIndicator />
        {/* Message Error Display */}
        {Object.keys(error.messages || {}).length > 0 && currentRoom?.id && (
          <div className="mx-4 mt-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            <p className="text-sm">{error.messages?.[currentRoom.id]}</p>
          </div>
        )}

        {currentRoom ? (
          <>
            {/* Chat Header */}
            <ChatHeader room={currentRoom} onBackToList={handleBackToList} />
            {/* Messages */}
            <MessageList
              ref={messageListRef}
              messages={currentMessages}
              isLoading={loading.messages[currentRoom.id]}
              conversationId={currentRoom.id}
              onLoadMore={() => loadMoreMessages(currentRoom.id)}
              hasMore={pagination.hasMore[currentRoom.id] ?? false}
              isLoadingMore={loading.loadingMore[currentRoom.id] ?? false}
            />
            {/* Message Input */}
            <MessageInput onSendMessage={handleSendMessage} conversationId={currentRoom.id} />
          </>
        ) : (
          /* Empty State */
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center text-gray-500 dark:text-gray-400">
              <MessageCircle size={64} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
              <h2 className="mb-2 font-semibold text-xl">Welcome to Chat</h2>
              <p>Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
