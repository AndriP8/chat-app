import type { User } from '@/types/database';

interface TypingIndicatorProps {
  typingUsers: User[];
  currentUserId?: string;
}

export const TypingIndicator = ({ typingUsers, currentUserId }: TypingIndicatorProps) => {
  const otherUsers = typingUsers.filter((user) => user.id !== currentUserId);

  if (otherUsers.length === 0) {
    return null;
  }

  return (
    <p className="flex-1 truncate text-blue-600 text-sm dark:text-blue-400">
      Typing
      <span className="ml-1 inline-flex gap-0.5">
        <span className="animation-delay-0 animate-bounce">.</span>
        <span className="animation-delay-200 animate-bounce">.</span>
        <span className="animation-delay-400 animate-bounce">.</span>
      </span>
    </p>
  );
};
