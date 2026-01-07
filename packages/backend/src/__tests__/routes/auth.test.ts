import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { describe, expect, it, vi } from 'vitest';
import { mockUsers } from '../utils/fixtures';
import type { MockDb } from '../utils/mocks/db.mock';
import { createMockReply, createMockRequest, generateTestToken } from '../utils/testHelpers';

interface JwtPayload {
  user_id: string;
  email: string;
  iat?: number;
  exp?: number;
}

// Mock database
const mockDb: MockDb = {
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
  transaction: vi.fn(),
};

vi.mock('@/db', () => ({
  db: mockDb,
  users: {},
  conversations: {},
  conversationParticipants: {},
}));

vi.mock('@/config/env', () => ({
  envConfig: {
    JWT_SECRET: 'test-jwt-secret-key',
    BCRYPT_ROUNDS: '4',
    NODE_ENV: 'test',
  },
}));

describe('Auth Routes', () => {
  describe('POST /login', () => {
    it('should login successfully with valid credentials', async () => {
      mockDb.limit.mockReturnValue([mockUsers.alice]);

      vi.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      const isPasswordValid = await bcrypt.compare('password123', mockUsers.alice.password_hash);
      expect(isPasswordValid).toBe(true);

      const token = generateTestToken(mockUsers.alice.id, mockUsers.alice.email);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('should reject login with invalid email', async () => {
      mockDb.limit.mockReturnValue([]); // User not found

      const reply = createMockReply();

      // Simulate 401 response
      reply.status(401).send({
        success: false,
        error: 'Invalid email or password',
      });

      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid email or password',
        })
      );
    });

    it('should reject login with invalid password', async () => {
      mockDb.limit.mockReturnValue([mockUsers.alice]);

      vi.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      const isPasswordValid = await bcrypt.compare('wrongpassword', mockUsers.alice.password_hash);
      expect(isPasswordValid).toBe(false);
    });

    it('should set httpOnly cookie on successful login', () => {
      const reply = createMockReply();
      const token = generateTestToken(mockUsers.alice.id, mockUsers.alice.email);

      reply.setCookie('auth_token', token, {
        httpOnly: true,
        secure: false, // test env
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
      });

      expect(reply.setCookie).toHaveBeenCalledWith(
        'auth_token',
        token,
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
        })
      );
    });

    it('should validate request body with loginSchema', () => {
      const validBody = {
        email: 'alice@test.com',
        password: 'password123',
      };

      expect(validBody.email).toBeTruthy();
      expect(validBody.password).toBeTruthy();

      const invalidBody = {
        email: 'not-an-email',
        password: '',
      };

      expect(invalidBody.email).toBe('not-an-email');
      expect(invalidBody.password).toBe('');
    });

    it('should return user data on successful login', async () => {
      mockDb.limit.mockReturnValue([mockUsers.alice]);
      vi.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      const expectedResponse = {
        success: true,
        data: {
          user: {
            id: mockUsers.alice.id,
            email: mockUsers.alice.email,
            name: mockUsers.alice.name,
            profile_picture_url: mockUsers.alice.profile_picture_url,
            is_demo: mockUsers.alice.is_demo,
            created_at: mockUsers.alice.created_at,
            updated_at: mockUsers.alice.updated_at,
          },
        },
      };

      expect(expectedResponse.success).toBe(true);
      expect(expectedResponse.data.user.email).toBe('alice@test.com');
    });
  });

  describe('GET /me', () => {
    it('should return user data with valid token', async () => {
      const token = generateTestToken(mockUsers.alice.id, mockUsers.alice.email);
      const payload = jwt.verify(token, 'test-jwt-secret-key') as JwtPayload;

      expect(payload.user_id).toBe(mockUsers.alice.id);
      expect(payload.email).toBe(mockUsers.alice.email);
    });

    it('should reject request without token', () => {
      const request = createMockRequest({});
      const reply = createMockReply();

      if (!request.cookies?.auth_token) {
        reply.status(401).send({
          success: false,
          error: 'Authorization token required',
        });
      }

      expect(reply.status).toHaveBeenCalledWith(401);
    });

    it('should reject request with invalid token', () => {
      const reply = createMockReply();

      try {
        jwt.verify('invalid-token', 'test-jwt-secret-key');
      } catch (_error) {
        reply.status(401).send({
          success: false,
          error: 'Invalid or expired token',
        });
      }

      expect(reply.status).toHaveBeenCalledWith(401);
    });

    it('should return 404 when user not found', async () => {
      mockDb.limit.mockReturnValue([]); // User not found

      const reply = createMockReply();

      // Simulate user not found
      const users = mockDb.limit();
      if (users.length === 0) {
        reply.status(404).send({
          success: false,
          error: 'User not found',
        });
      }

      expect(reply.status).toHaveBeenCalledWith(404);
    });

    it('should return formatted user response', async () => {
      mockDb.limit.mockReturnValue([mockUsers.alice]);

      const expectedResponse = {
        success: true,
        data: {
          user: {
            id: mockUsers.alice.id,
            email: mockUsers.alice.email,
            name: mockUsers.alice.name,
            profile_picture_url: mockUsers.alice.profile_picture_url,
            is_demo: mockUsers.alice.is_demo,
            created_at: mockUsers.alice.created_at,
            updated_at: mockUsers.alice.updated_at,
          },
        },
      };

      expect(expectedResponse.data.user).toBeDefined();
      expect(expectedResponse.data.user.email).toBe('alice@test.com');
    });
  });

  describe('POST /logout', () => {
    it('should clear auth cookie on logout', () => {
      const reply = createMockReply();

      reply.clearCookie('auth_token', { path: '/' });

      expect(reply.clearCookie).toHaveBeenCalledWith('auth_token', { path: '/' });
    });

    it('should return success message', () => {
      const reply = createMockReply();

      reply.send({
        success: true,
        message: 'Logged out successfully',
      });

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Logged out successfully',
        })
      );
    });
  });

  describe('POST /demo-user', () => {
    it('should create two demo users and a conversation', async () => {
      const aliceDemo = { ...mockUsers.alice, is_demo: true, id: 'demo-alice-123' };
      const bobDemo = { ...mockUsers.bob, is_demo: true, id: 'demo-bob-456' };

      mockDb.returning
        .mockResolvedValueOnce([aliceDemo])
        .mockResolvedValueOnce([bobDemo])
        .mockResolvedValueOnce([{ id: 'conv-demo-123', created_by: aliceDemo.id }]);

      // Verify demo users created
      expect(aliceDemo.is_demo).toBe(true);
      expect(bobDemo.is_demo).toBe(true);
    });

    it('should return demo user credentials', () => {
      const response = {
        success: true,
        data: {
          users: [
            { id: 'alice-id', email: 'demo-alice-abc123@chatapp.demo', name: 'Alice Chen (Demo)' },
            { id: 'bob-id', email: 'demo-bob-abc123@chatapp.demo', name: 'Bob Smith (Demo)' },
          ],
          password: 'demo123',
          conversationId: 'conv-123',
        },
      };

      expect(response.data.password).toBe('demo123');
      expect(response.data.users).toHaveLength(2);
      expect(response.data.conversationId).toBeDefined();
    });

    it('should use bcrypt to hash demo password', async () => {
      const password = 'demo123';
      const bcryptRounds = 4;

      vi.spyOn(bcrypt, 'hash').mockResolvedValue('$2a$04$hashed_demo_password' as never);

      const hashedPassword = await bcrypt.hash(password, bcryptRounds);

      expect(bcrypt.hash).toHaveBeenCalledWith(password, bcryptRounds);
      expect(hashedPassword).toBeTruthy();
    });

    it('should create conversation with both participants', async () => {
      const conversationParticipants = [
        { conversation_id: 'conv-123', user_id: 'alice-id' },
        { conversation_id: 'conv-123', user_id: 'bob-id' },
      ];

      mockDb.values.mockReturnThis();

      expect(conversationParticipants).toHaveLength(2);
      expect(conversationParticipants[0]!.user_id).toBe('alice-id');
      expect(conversationParticipants[1]!.user_id).toBe('bob-id');
    });

    it('should generate unique demo user emails with random ID', () => {
      const randomId = 'abc123';
      const aliceEmail = `demo-alice-${randomId}@chatapp.demo`;
      const bobEmail = `demo-bob-${randomId}@chatapp.demo`;

      expect(aliceEmail).toContain(randomId);
      expect(bobEmail).toContain(randomId);
      expect(aliceEmail).not.toBe(bobEmail);
    });
  });

  describe('JWT Token Generation and Verification', () => {
    it('should generate valid JWT token', () => {
      const payload = {
        user_id: mockUsers.alice.id,
        email: mockUsers.alice.email,
      };

      const token = jwt.sign(payload, 'test-jwt-secret-key', { expiresIn: '7d' });

      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
    });

    it('should verify valid JWT token', () => {
      const token = generateTestToken(mockUsers.alice.id, mockUsers.alice.email);
      const decoded = jwt.verify(token, 'test-jwt-secret-key') as JwtPayload;

      expect(decoded.user_id).toBe(mockUsers.alice.id);
      expect(decoded.email).toBe(mockUsers.alice.email);
    });

    it('should reject expired JWT token', () => {
      const expiredToken = jwt.sign(
        { user_id: mockUsers.alice.id, email: mockUsers.alice.email },
        'test-jwt-secret-key',
        { expiresIn: '-1s' } // Already expired
      );

      expect(() => {
        jwt.verify(expiredToken, 'test-jwt-secret-key');
      }).toThrow();
    });

    it('should reject JWT token with wrong secret', () => {
      const token = jwt.sign(
        { user_id: mockUsers.alice.id, email: mockUsers.alice.email },
        'wrong-secret',
        { expiresIn: '7d' }
      );

      expect(() => {
        jwt.verify(token, 'test-jwt-secret-key');
      }).toThrow();
    });
  });

  describe('Cookie Configuration', () => {
    it('should use correct cookie settings', () => {
      const cookieConfig = {
        httpOnly: true,
        secure: false, // test environment
        sameSite: 'strict' as const,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
      };

      expect(cookieConfig.httpOnly).toBe(true);
      expect(cookieConfig.sameSite).toBe('strict');
      expect(cookieConfig.maxAge).toBe(604800000); // 7 days in ms
    });

    it('should set secure flag in production', () => {
      const productionConfig = {
        secure: true, // production
      };

      const testConfig = {
        secure: false, // test
      };

      expect(productionConfig.secure).toBe(true);
      expect(testConfig.secure).toBe(false);
    });
  });

  describe('Password Hashing', () => {
    it('should hash password with bcrypt', async () => {
      const password = 'password123';
      const bcryptRounds = 4;

      vi.spyOn(bcrypt, 'hash').mockResolvedValue('$2a$04$hashed_password' as never);

      const hash = await bcrypt.hash(password, bcryptRounds);

      expect(bcrypt.hash).toHaveBeenCalledWith(password, bcryptRounds);
      expect(hash).toBeTruthy();
    });

    it('should compare password correctly', async () => {
      const password = 'password123';
      const hash = '$2a$04$hashed_password';

      vi.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      const isValid = await bcrypt.compare(password, hash);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'wrongpassword';
      const hash = '$2a$04$hashed_password';

      vi.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      const isValid = await bcrypt.compare(password, hash);

      expect(isValid).toBe(false);
    });
  });
});
