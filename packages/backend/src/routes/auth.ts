import { randomBytes } from 'node:crypto';
import rateLimit from '@fastify/rate-limit';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { envConfig } from '@/config/env';
import { conversationParticipants, conversations, db, type User, users } from '@/db';
import { loginSchema, type UserResponse } from '@/schemas/auth';
import { transformUserToResponse } from '@/utils/transformers';

// JWT utilities
const JWT_SECRET = envConfig.JWT_SECRET;
const BCRYPT_ROUNDS = Number.parseInt(envConfig.BCRYPT_ROUNDS || '12', 10);

// Cookie configuration
const COOKIE_CONFIG = {
  AUTH_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  OPTIONS: {
    httpOnly: true,
    secure: envConfig.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    path: '/',
  },
};

interface JWTPayload {
  user_id: string;
  email: string;
}

function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
}

function formatUserResponse(user: User): UserResponse {
  return transformUserToResponse(user);
}

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  // Login endpoint
  fastify.post('/login', async (request, reply) => {
    try {
      const { success, data, error } = loginSchema.safeParse(request.body);
      if (!success) {
        return reply.status(400).send({
          success: false,
          error: 'Validation failed',
          details: error.flatten().fieldErrors,
        });
      }
      const { email, password } = data;

      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

      if (!user) {
        return reply.status(401).send({
          success: false,
          error: 'Invalid email or password',
        });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        return reply.status(401).send({
          success: false,
          error: 'Invalid email or password',
        });
      }

      const token = generateToken({ user_id: user.id, email: user.email });

      reply.setCookie(COOKIE_CONFIG.AUTH_TOKEN, token, COOKIE_CONFIG.OPTIONS);

      const response = {
        user: formatUserResponse(user),
      };

      return reply.send({
        success: true,
        data: response,
      });
    } catch (_error) {
      return reply.status(500).send({
        success: false,
        error: 'Login failed',
      });
    }
  });

  // Get current user endpoint
  fastify.get('/me', async (request, reply) => {
    try {
      const token = request.cookies?.[COOKIE_CONFIG.AUTH_TOKEN];
      if (!token) {
        return reply.status(401).send({
          success: false,
          error: 'Authorization token required',
        });
      }

      const payload = verifyToken(token);
      const userId = payload.user_id;

      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: 'User not found',
        });
      }

      return reply.send({
        success: true,
        data: { user: formatUserResponse(user) },
      });
    } catch (error) {
      console.error('Get user error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get user information',
      });
    }
  });

  // Logout endpoint
  fastify.post('/logout', async (_request, reply) => {
    // Clear the authentication cookie
    reply.clearCookie(COOKIE_CONFIG.AUTH_TOKEN, {
      path: COOKIE_CONFIG.OPTIONS.path,
    });

    return reply.send({
      success: true,
      message: 'Logged out successfully',
    });
  });

  await fastify.register(rateLimit, {
    max: 5,
    timeWindow: '1 hour',
    keyGenerator: (request) => {
      return request.ip;
    },
  });

  fastify.post('/demo-user', async (_request, reply) => {
    try {
      const randomId = randomBytes(4).toString('hex');
      const demoPassword = 'demo123'; // Fixed password for all demo users

      const passwordHash = await bcrypt.hash(demoPassword, BCRYPT_ROUNDS);

      const [aliceUser] = await db
        .insert(users)
        .values({
          email: `demo-alice-${randomId}@chatapp.demo`,
          password_hash: passwordHash,
          name: 'Alice Chen (Demo)',
          profile_picture_url: null,
          is_demo: true,
        })
        .returning();

      if (!aliceUser) {
        return reply.status(500).send({
          success: false,
          error: 'Failed to create demo user Alice',
        });
      }

      const [bobUser] = await db
        .insert(users)
        .values({
          email: `demo-bob-${randomId}@chatapp.demo`,
          password_hash: passwordHash,
          name: 'Bob Smith (Demo)',
          profile_picture_url: null,
          is_demo: true,
        })
        .returning();

      if (!bobUser) {
        return reply.status(500).send({
          success: false,
          error: 'Failed to create demo user Bob',
        });
      }

      const [conversation] = await db
        .insert(conversations)
        .values({
          name: null, // No name for direct conversations
          created_by: aliceUser.id,
        })
        .returning();

      if (!conversation) {
        return reply.status(500).send({
          success: false,
          error: 'Failed to create conversation',
        });
      }

      await db.insert(conversationParticipants).values([
        {
          conversation_id: conversation.id,
          user_id: aliceUser.id,
        },
        {
          conversation_id: conversation.id,
          user_id: bobUser.id,
        },
      ]);

      const response = {
        users: [
          {
            id: aliceUser.id,
            email: aliceUser.email,
            name: aliceUser.name,
          },
          {
            id: bobUser.id,
            email: bobUser.email,
            name: bobUser.name,
          },
        ],
        password: demoPassword,
        conversationId: conversation.id,
      };

      return reply.status(201).send({
        success: true,
        data: response,
      });
    } catch (error) {
      console.error('Demo user creation error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to create demo users',
      });
    }
  });
}
