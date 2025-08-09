import { useState, useRef } from "react";
import { Send, Paperclip, Smile } from "lucide-react";

interface MessageInputProps {
  onSendMessage: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const MessageInput = ({
  onSendMessage,
  disabled = false,
  placeholder = "Type a message...",
}: MessageInputProps) => {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedMessage = message.trim();

    if (trimmedMessage && !disabled) {
      onSendMessage(trimmedMessage);
      setMessage("");

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);

    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  };

  return (
    <div className="p-4 bg-white border-t border-gray-200">
      <form onSubmit={handleSubmit} className="flex items-end gap-3">
        {/* Attachment button */}
        <button
          type="button"
          className="flex-shrink-0 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Attach file"
          disabled={disabled}
        >
          <Paperclip size={20} />
        </button>

        {/* Message input container */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="w-full px-4 py-3 pr-12 bg-gray-50 border border-gray-200 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ minHeight: "48px", maxHeight: "120px" }}
          />

          {/* Emoji button */}
          <button
            type="button"
            className="absolute right-3 bottom-3 p-1 text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Add emoji"
            disabled={disabled}
          >
            <Smile size={18} />
          </button>
        </div>

        {/* Send button */}
        <button
          type="submit"
          disabled={disabled || !message.trim()}
          className="flex-shrink-0 p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Send message"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
};
