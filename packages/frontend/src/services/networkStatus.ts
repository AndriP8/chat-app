/**
 * Network status service for managing online/offline state
 * Provides centralized network status management with event listeners
 */

type NetworkStatusListener = (isOnline: boolean) => void;

class NetworkStatusService {
  private listeners: Set<NetworkStatusListener> = new Set();
  private _isOnline: boolean = navigator.onLine;

  constructor() {
    // Listen for online/offline events
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  private handleOnline = (): void => {
    this._isOnline = true;
    this.notifyListeners();
  };

  private handleOffline = (): void => {
    this._isOnline = false;
    this.notifyListeners();
  };

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this._isOnline);
      } catch (error) {
        console.error('Error in network status listener:', error);
      }
    }
  }

  /**
   * Get current online status
   */
  get isOnline(): boolean {
    return this._isOnline;
  }

  /**
   * Add a listener for network status changes
   * @param listener - Function to call when network status changes
   * @returns Function to remove the listener
   */
  addListener(listener: NetworkStatusListener): () => void {
    this.listeners.add(listener);

    // Return cleanup function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Remove a specific listener
   */
  removeListener(listener: NetworkStatusListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(): void {
    this.listeners.clear();
  }

  /**
   * Cleanup method to remove event listeners
   */
  destroy(): void {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    this.removeAllListeners();
  }
}

// Create singleton instance
export const networkStatusService = new NetworkStatusService();
