import { ArrowDown } from 'lucide-react';

interface ScrollToBottomButtonProps {
  onClick: () => void;
  unreadCount?: number;
}

export const ScrollToBottomButton = ({ onClick, unreadCount = 0 }: ScrollToBottomButtonProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute right-8 bottom-8 flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 text-white shadow-lg transition-all hover:bg-blue-600 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      aria-label={
        unreadCount > 0 ? `Scroll to bottom (${unreadCount} new messages)` : 'Scroll to bottom'
      }
    >
      <ArrowDown size={20} />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 font-medium text-white text-xs">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
};
