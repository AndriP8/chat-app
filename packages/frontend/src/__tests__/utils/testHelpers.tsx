/**
 * Wait for a condition to be true with a timeout
 */
export async function waitFor(
  condition: () => boolean,
  timeout = 5000,
  interval = 50
): Promise<void> {
  const startTime = Date.now();

  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error(`Timeout waiting for condition after ${timeout}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

/**
 * Simulate async delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Mock IndexedDB transaction helper
 */
export async function mockTransaction<T>(callback: () => Promise<T>): Promise<T> {
  // fake-indexeddb runs transactions synchronously in tests
  // This helper ensures consistent behavior
  return callback();
}

/**
 * Clear all IndexedDB databases - useful for resetting state between tests
 */
export async function clearAllDatabases(): Promise<void> {
  const databases = await indexedDB.databases();
  const deletions = databases
    .map((db) => {
      if (db.name) {
        return new Promise<void>((resolve, reject) => {
          const request = indexedDB.deleteDatabase(db.name!);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      }
      return undefined;
    })
    .filter((promise): promise is Promise<void> => promise !== undefined);

  await Promise.all(deletions);
}

// Re-export commonly used testing-library utilities
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
