import type { WebSocket } from '@fastify/websocket';
import type { Mock } from 'vitest';
import { vi } from 'vitest';

export interface MockWebSocketConnection {
  socket: WebSocket;
  user: {
    id: string;
    email: string;
    name: string;
    profile_picture_url?: string | null;
  };
  conversationIds: Set<string>;
}

export interface MockConnectionManager {
  connections: Map<string, Set<MockWebSocketConnection>>;
  addConnection: Mock;
  removeConnection: Mock;
  addUserToConversation: Mock;
  removeUserFromConversation: Mock;
  broadcastToConversation: Mock;
  storeTempIdMapping: Mock;
  getTempIdForMessage: Mock;
  removeTempIdMapping: Mock;
}

/**
 * Create a mock ConnectionManager
 */
export function createMockConnectionManager(): MockConnectionManager {
  const connections = new Map<string, Set<MockWebSocketConnection>>();

  return {
    connections, // Expose for testing
    addConnection: vi.fn((conn: MockWebSocketConnection) => {
      if (!connections.has(conn.user.id)) {
        connections.set(conn.user.id, new Set());
      }
      connections.get(conn.user.id)!.add(conn);
    }),
    removeConnection: vi.fn((conn: MockWebSocketConnection) => {
      const userConns = connections.get(conn.user.id);
      if (userConns) {
        userConns.delete(conn);
        if (userConns.size === 0) {
          connections.delete(conn.user.id);
        }
      }
    }),
    addUserToConversation: vi.fn(),
    removeUserFromConversation: vi.fn(),
    broadcastToConversation: vi.fn(),
    storeTempIdMapping: vi.fn(),
    getTempIdForMessage: vi.fn(),
    removeTempIdMapping: vi.fn(),
  };
}
