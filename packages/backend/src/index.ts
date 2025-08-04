import Fastify from 'fastify';
import cors from '@fastify/cors';
import env from '@fastify/env';
import websocket from '@fastify/websocket';
import { envSchema, type EnvConfig } from './config/env.js';
import { healthRoutes } from './routes/health.js';

// Extend Fastify instance type to include config
declare module 'fastify' {
  interface FastifyInstance {
    config: EnvConfig;
  }
}

async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  // Register environment variables
  await fastify.register(env, {
    schema: envSchema,
    dotenv: true,
  });

  // Register CORS
  await fastify.register(cors, {
    origin: fastify.config.CORS_ORIGIN,
    credentials: true,
  });

  // Register WebSocket support
  await fastify.register(websocket);

  // Register routes
  await fastify.register(healthRoutes, { prefix: '/api' });

  // WebSocket route for real-time chat
  fastify.register(async (fastify) => {
    fastify.get('/ws', { websocket: true }, (connection, req) => {
      connection.on('message', (message: Buffer) => {
        // Echo message back for now - will implement proper chat logic later
        connection.send(`Echo: ${message.toString()}`);
      });

      connection.on('close', () => {
        console.log('Client disconnected');
      });
    });
  });

  return fastify;
}

async function start() {
  try {
    const fastify = await buildServer();
    
    const host = fastify.config.HOST;
    const port = Number.parseInt(fastify.config.PORT, 10);

    await fastify.listen({ host, port });
    
    console.log(`🚀 Server running at http://${host}:${port}`);
    console.log(`📊 Health check: http://${host}:${port}/api/health`);
    console.log(`🔌 WebSocket: ws://${host}:${port}/ws`);
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
}

// Start the server
start();