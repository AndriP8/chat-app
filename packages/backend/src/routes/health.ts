import type { FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";
import { envConfig } from "@/config/env";

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get("/health", async () => {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: envConfig.NODE_ENV,
    };
  });

  fastify.get("/health/db", async (_request, reply) => {
    try {
      // Simple database health check
      const { db } = await import("../db/index");
      await db.execute(sql`SELECT 1`);

      return {
        status: "ok",
        database: "connected",
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      reply.code(503);
      return {
        status: "error",
        database: "disconnected",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      };
    }
  });
}
