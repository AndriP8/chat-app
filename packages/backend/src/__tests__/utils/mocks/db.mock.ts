import type { Mock } from 'vitest';
import { vi } from 'vitest';

export interface MockQuery<_T = unknown> {
  select: Mock;
  from: Mock;
  where: Mock;
  orderBy: Mock;
  limit: Mock;
  innerJoin: Mock;
  returning: Mock;
  execute: Mock;
}

export interface MockDb {
  select: Mock;
  insert: Mock;
  update: Mock;
  delete: Mock;
  from: Mock;
  where: Mock;
  orderBy: Mock;
  limit: Mock;
  innerJoin: Mock;
  values: Mock;
  returning: Mock;
  set: Mock;
  transaction: Mock;
}

/**
 * Create a chainable mock query builder for Drizzle
 */
export function createMockQuery<T = unknown>(returnValue: T[] = []): MockQuery<T> {
  const query = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(returnValue),
    execute: vi.fn().mockResolvedValue(returnValue),
  };

  // Make query chainable and return the data
  query.limit.mockReturnValue(returnValue);
  query.where.mockReturnValue(returnValue);

  return query;
}

/**
 * Create a mock database instance
 */
export function createMockDb(): MockDb {
  return {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnValue([]),
    innerJoin: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    set: vi.fn().mockReturnThis(),
    transaction: vi.fn((fn) => fn(createMockDb())),
  };
}

export interface MockDbModule {
  db: MockDb;
  users: unknown;
  messages: unknown;
  conversations: unknown;
  conversationParticipants: unknown;
}

/**
 * Mock the entire db module
 */
export function mockDbModule(mockData: Record<string, unknown> = {}): MockDbModule {
  return {
    db: createMockDb(),
    users: mockData.users || {},
    messages: mockData.messages || {},
    conversations: mockData.conversations || {},
    conversationParticipants: mockData.conversationParticipants || {},
  };
}
