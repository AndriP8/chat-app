/**
 * Secure storage helper that wraps localStorage with error handling and type safety
 */
export const secureStorage = {
  /**
   * Get an item from localStorage with type safety
   * @param key - The storage key
   * @param defaultValue - Default value if key doesn't exist or parsing fails
   * @returns The parsed value or default value
   */
  get<T>(key: string, defaultValue: T): T {
    try {
      const item = localStorage.getItem(key);
      if (item === null) {
        return defaultValue;
      }
      return JSON.parse(item) as T;
    } catch (error) {
      console.warn(`Failed to get item from localStorage with key "${key}":`, error);
      return defaultValue;
    }
  },

  /**
   * Set an item in localStorage with JSON serialization
   * @param key - The storage key
   * @param value - The value to store
   * @returns true if successful, false otherwise
   */
  set<T>(key: string, value: T): boolean {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn(`Failed to set item in localStorage with key "${key}":`, error);
      return false;
    }
  },

  /**
   * Remove an item from localStorage
   * @param key - The storage key
   * @returns true if successful, false otherwise
   */
  remove(key: string): boolean {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.warn(`Failed to remove item from localStorage with key "${key}":`, error);
      return false;
    }
  },

  /**
   * Clear all items from localStorage
   * @returns true if successful, false otherwise
   */
  clear(): boolean {
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      console.warn('Failed to clear localStorage:', error);
      return false;
    }
  },

  /**
   * Check if a key exists in localStorage
   * @param key - The storage key
   * @returns true if key exists, false otherwise
   */
  has(key: string): boolean {
    try {
      return localStorage.getItem(key) !== null;
    } catch (error) {
      console.warn(`Failed to check if key "${key}" exists in localStorage:`, error);
      return false;
    }
  }
};

/**
 * Extract error message from various error types
 * @param error - The error object (can be Error, string, or unknown)
 * @returns A user-friendly error message
 */
export const getErrorMessage = (error: unknown): string => {
  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  // Handle API error objects with message property
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
  }

  // Handle API error objects with error property
  if (error && typeof error === 'object' && 'error' in error) {
    const errorMsg = (error as { error: unknown }).error;
    if (typeof errorMsg === 'string') {
      return errorMsg;
    }
  }

  return 'An unexpected error occurred';
};

/**
 * Safely convert any date value to a proper Date object
 * This helps prevent "getTime is not a function" errors
 */
export function ensureDate(date: Date | string | number | undefined | null): Date {
  if (!date) {
    return new Date();
  }
  
  if (date instanceof Date) {
    return date;
  }
  
  try {
    return new Date(date);
  } catch (error) {
    console.error('Failed to convert to Date:', error);
    return new Date();
  }
}

/**
  * Format a date for message timestamps
  * @param date - The date to format
  * @returns Formatted time string (e.g., "2:30 PM", "Yesterday", "Jan 15")
  */
export const formatMessageTime = (date: Date): string => {
  const now = new Date();
  const messageDate = new Date(date);
  
  // Check if it's today
  const isToday = now.toDateString() === messageDate.toDateString();
  
  if (isToday) {
    return messageDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }
  
  // Check if it's yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = yesterday.toDateString() === messageDate.toDateString();
  
  if (isYesterday) {
    return 'Yesterday';
  }
  
  // Check if it's within the current year
  const isCurrentYear = now.getFullYear() === messageDate.getFullYear();
  
  if (isCurrentYear) {
    return messageDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  }
  
  // For older dates, include the year
  return messageDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};