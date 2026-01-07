import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

// Clean up after each test
afterEach(() => {
  cleanup();
});

// Mock BroadcastChannel
class MockBroadcastChannel {
  name: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  private static channels = new Map<string, MockBroadcastChannel[]>();

  constructor(channelName: string) {
    this.name = channelName;
    if (!MockBroadcastChannel.channels.has(channelName)) {
      MockBroadcastChannel.channels.set(channelName, []);
    }
    MockBroadcastChannel.channels.get(channelName)!.push(this);
  }

  postMessage(message: unknown): void {
    const channels = MockBroadcastChannel.channels.get(this.name) || [];
    channels.forEach((channel) => {
      if (channel !== this && channel.onmessage) {
        channel.onmessage(new MessageEvent('message', { data: message }));
      }
    });
  }

  close(): void {
    const channels = MockBroadcastChannel.channels.get(this.name) || [];
    const index = channels.indexOf(this);
    if (index > -1) {
      channels.splice(index, 1);
    }
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void): void {
    if (type === 'message') {
      this.onmessage = listener;
    }
  }

  removeEventListener(): void {
    this.onmessage = null;
  }

  static reset(): void {
    MockBroadcastChannel.channels.clear();
  }
}

// Install BroadcastChannel mock
globalThis.BroadcastChannel = MockBroadcastChannel as unknown as typeof BroadcastChannel;

// Reset BroadcastChannel between tests
beforeEach(() => {
  MockBroadcastChannel.reset();
});

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  url: string;
  readyState: number = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    // Simulate async connection
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 0);
  }

  send(_data: string): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    // Message sending is mocked - tests can spy on this
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSING;
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED;
      if (this.onclose) {
        this.onclose(new CloseEvent('close'));
      }
    }, 0);
  }

  addEventListener(type: string, listener: (event: Event) => void): void {
    if (type === 'open') this.onopen = listener;
    if (type === 'close') this.onclose = listener as (event: CloseEvent) => void;
    if (type === 'error') this.onerror = listener;
    if (type === 'message') this.onmessage = listener as (event: MessageEvent) => void;
  }

  removeEventListener(): void {
    // No-op for tests
  }
}

globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;

// Mock ServiceWorkerRegistration
globalThis.ServiceWorkerRegistration = class ServiceWorkerRegistration {
  sync = {
    register: vi.fn().mockResolvedValue(undefined),
    getTags: vi.fn().mockResolvedValue([]),
  };
  // biome-ignore lint/suspicious/noExplicitAny: <>
} as any;

// Mock navigator.serviceWorker
const serviceWorkerEventListeners = new Map<string, Set<(event: Event) => void>>();

Object.defineProperty(navigator, 'serviceWorker', {
  value: {
    ready: Promise.resolve({
      sync: {
        register: vi.fn().mockResolvedValue(undefined),
        getTags: vi.fn().mockResolvedValue([]),
      },
    }),
    addEventListener: vi.fn((type: string, listener: (event: Event) => void) => {
      if (!serviceWorkerEventListeners.has(type)) {
        serviceWorkerEventListeners.set(type, new Set());
      }
      serviceWorkerEventListeners.get(type)!.add(listener);
    }),
    removeEventListener: vi.fn((type: string, listener: (event: Event) => void) => {
      serviceWorkerEventListeners.get(type)?.delete(listener);
    }),
    dispatchEvent: vi.fn((event: Event) => {
      const listeners = serviceWorkerEventListeners.get(event.type);
      if (listeners) {
        for (const listener of listeners) {
          listener(event);
        }
      }
      return true;
    }),
  },
  writable: true,
  configurable: true,
});

// Reset service worker listeners between tests
beforeEach(() => {
  serviceWorkerEventListeners.clear();
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Reset localStorage between tests
beforeEach(() => {
  localStorageMock.clear();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Suppress console errors in tests (optional - uncomment if needed)
// global.console.error = vi.fn();
// global.console.warn = vi.fn();
