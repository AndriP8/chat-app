import type { MockDb } from './db.mock';

/**
 * Type helper to cast the mocked db module
 * Use this when importing @/db in tests
 */
export interface MockedDbModule {
  db: MockDb;
  users: unknown;
  messages: unknown;
  conversations: unknown;
  conversationParticipants: unknown;
}

/**
 * Helper to properly type the mocked db import
 */
export function getMockedDb() {
  // This will be the mocked version at runtime
  return require('@/db') as MockedDbModule;
}
