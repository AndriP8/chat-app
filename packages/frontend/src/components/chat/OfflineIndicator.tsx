import { useOnlineStatus } from '@/hooks/usePWA';

interface OfflineIndicatorProps {
  className?: string;
}

export function OfflineIndicator({ className = '' }: OfflineIndicatorProps) {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-2 text-sm ${className}`}>
      <div className="flex items-center gap-2 text-red-600 bg-red-50 px-2 py-1 rounded">
        <div className="w-2 h-2 bg-red-500 rounded-full" />
        <span>Offline</span>
      </div>
    </div>
  );
}

export default OfflineIndicator;
