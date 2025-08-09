import type { FastifyRequest, FastifyReply } from "fastify";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db, users } from "@/db";
import { envConfig } from "@/config/env";

interface JWTPayload {
  user_id: string;
  email: string;
}

// Extend FastifyRequest to include user property
declare module "fastify" {
  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
      name: string;
      profile_picture_url?: string | null;
    };
  }
}

const JWT_SECRET = envConfig.JWT_SECRET;
const COOKIE_CONFIG = {
  AUTH_TOKEN: "auth_token",
};

function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Get token from cookie
    const token = request.cookies?.[COOKIE_CONFIG.AUTH_TOKEN];
    
    if (!token) {
      return reply.status(401).send({
        success: false,
        error: "Authorization token required",
        code: "NO_TOKEN",
      });
    }

    // Verify token
    const payload = verifyToken(token);
    const userId = payload.user_id;

    // Get user from database
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        profile_picture_url: users.profile_picture_url,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return reply.status(401).send({
        success: false,
        error: "Invalid token - user not found",
        code: "INVALID_TOKEN",
      });
    }

    // Attach user to request
    request.user = user;
    return;
  } catch (error) {
    console.error("Auth middleware error:", error);
    return reply.status(401).send({
      success: false,
      error: "Invalid or expired token",
      code: "INVALID_TOKEN",
    });
  }
}