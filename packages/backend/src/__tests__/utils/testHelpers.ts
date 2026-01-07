import type { WebSocket } from '@fastify/websocket';
import jwt from 'jsonwebtoken';
import type { Mock } from 'vitest';
import { vi } from 'vitest';

export interface MockReply {
  status: Mock;
  send: Mock;
  setCookie: Mock;
  clearCookie: Mock;
}

/**
 * Generate a test JWT token
 */
export function generateTestToken(userId: string, email: string): string {
  return jwt.sign({ user_id: userId, email }, 'test-jwt-secret-key', { expiresIn: '7d' });
}

/**
 * Create a mock WebSocket connection
 */
export function createMockWebSocket(): WebSocket {
  const mockWs = {
    send: vi.fn(),
    close: vi.fn(),
    on: vi.fn(),
    readyState: 1, // OPEN
    removeListener: vi.fn(),
  };
  return mockWs as unknown as WebSocket;
}

/**
 * Create a mock Fastify request with cookies
 */
export function createMockRequest(cookies: Record<string, string> = {}) {
  return {
    cookies,
    user: undefined,
  };
}

/**
 * Create a mock Fastify reply
 */
export function createMockReply(): MockReply {
  const reply = {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    setCookie: vi.fn().mockReturnThis(),
    clearCookie: vi.fn().mockReturnThis(),
  };
  return reply;
}

/**
 * Wait for a specified time (for timer testing)
 */
export function waitFor(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
