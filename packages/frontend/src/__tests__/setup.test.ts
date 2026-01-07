import { beforeEach, describe, expect, it } from 'vitest';
import { clearAllDatabases } from './utils/testHelpers';

/**
 * Smoke test to verify test infrastructure is working correctly
 */
describe('Test Infrastructure', () => {
  it('should have vitest globals available', () => {
    expect(describe).toBeDefined();
    expect(it).toBeDefined();
    expect(expect).toBeDefined();
  });

  it('should have IndexedDB available (fake-indexeddb)', () => {
    expect(indexedDB).toBeDefined();
    expect(typeof indexedDB.open).toBe('function');
  });

  it('should have BroadcastChannel mock available', () => {
    expect(BroadcastChannel).toBeDefined();
    const channel = new BroadcastChannel('test-channel');
    expect(channel).toBeDefined();
    expect(channel.name).toBe('test-channel');
    channel.close();
  });

  it('should have WebSocket mock available', () => {
    expect(WebSocket).toBeDefined();
    const ws = new WebSocket('ws://localhost:3001');
    expect(ws).toBeDefined();
    expect(ws.url).toBe('ws://localhost:3001');
  });

  it('should have localStorage mock available', () => {
    expect(localStorage).toBeDefined();
    localStorage.setItem('test', 'value');
    expect(localStorage.getItem('test')).toBe('value');
    localStorage.removeItem('test');
    expect(localStorage.getItem('test')).toBeNull();
  });

  it('should have navigator.serviceWorker mock available', () => {
    expect(navigator.serviceWorker).toBeDefined();
    expect(navigator.serviceWorker.ready).toBeDefined();
  });

  it('should have window.matchMedia mock available', () => {
    expect(window.matchMedia).toBeDefined();
    const mediaQuery = window.matchMedia('(min-width: 768px)');
    expect(mediaQuery).toBeDefined();
    expect(mediaQuery.matches).toBe(false);
  });

  describe('IndexedDB operations', () => {
    beforeEach(async () => {
      await clearAllDatabases();
    });

    it('should create and open a database', async () => {
      const dbName = 'TestDB';
      const request = indexedDB.open(dbName, 1);

      await new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const db = request.result;
          expect(db.name).toBe(dbName);
          db.close();
          resolve(undefined);
        };
        request.onerror = () => reject(request.error);
        request.onupgradeneeded = () => {
          const db = request.result;
          db.createObjectStore('test-store', { keyPath: 'id' });
        };
      });
    });

    it('should store and retrieve data from IndexedDB', async () => {
      const dbName = 'TestDB2';
      const storeName = 'items';

      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onupgradeneeded = () => {
          const db = request.result;
          db.createObjectStore(storeName, { keyPath: 'id' });
        };
      });

      const testData = { id: 1, name: 'Test Item' };

      // Store data
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.add(testData);
        request.onsuccess = () => resolve(undefined);
        request.onerror = () => reject(request.error);
      });

      // Retrieve data
      const retrievedData = await new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      expect(retrievedData).toEqual(testData);
      db.close();
    });
  });

  describe('BroadcastChannel operations', () => {
    it('should send and receive messages between channels', async () => {
      const channelName = 'test-broadcast';
      const testMessage = { type: 'TEST', data: 'hello' };

      const messagePromise = new Promise((resolve) => {
        const receiver = new BroadcastChannel(channelName);
        receiver.onmessage = (event) => {
          expect(event.data).toEqual(testMessage);
          receiver.close();
          resolve(undefined);
        };

        // Send message after setting up receiver
        setTimeout(() => {
          const sender = new BroadcastChannel(channelName);
          sender.postMessage(testMessage);
          sender.close();
        }, 0);
      });

      await messagePromise;
    });
  });
});
