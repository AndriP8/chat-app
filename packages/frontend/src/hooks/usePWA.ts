import { useState, useEffect } from 'react';
import { networkStatusService } from '../services/networkStatus';

/**
 * Hook for online/offline status only
 * Uses centralized NetworkStatusService
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(networkStatusService.isOnline);

  useEffect(() => {
    const removeListener = networkStatusService.addListener(setIsOnline);
    return removeListener;
  }, []);

  return isOnline;
}
