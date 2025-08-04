import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: fastify.config.NODE_ENV,
    };
  });

  fastify.get('/health/db', async (_request, reply) => {
    try {
      // Simple database health check
      const { db } = await import('../db/index.js');
      await db.execute(sql`SELECT 1`);
      
      return {
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      reply.code(503);
      return {
        status: 'error',
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  });
}