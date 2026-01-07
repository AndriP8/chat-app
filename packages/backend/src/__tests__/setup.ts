import { afterEach, beforeAll, vi } from 'vitest';

// Set test environment variables
beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-key';
  process.env.BCRYPT_ROUNDS = '4'; // Lower rounds for faster tests
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
  process.env.CORS_ORIGIN = 'http://localhost:5173';
  process.env.HOST = '0.0.0.0';
  process.env.PORT = '3001';
});

// Clean up mocks after each test
afterEach(() => {
  vi.clearAllMocks();
  vi.clearAllTimers();
});
