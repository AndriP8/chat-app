import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import cookie from "@fastify/cookie";
import { envConfig } from "@/config/env";
import { healthRoutes } from "@/routes/health";
import { authRoutes } from "@/routes/auth";

async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: envConfig.NODE_ENV === "production" ? "info" : "debug",
    },
  });

  await fastify.register(cors, {
    origin: envConfig.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  });

  // Register cookie support
  await fastify.register(cookie, {
    secret: envConfig.JWT_SECRET,
    parseOptions: {
      httpOnly: true,
      secure: envConfig.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  });

  // Register WebSocket support
  await fastify.register(websocket);

  // Register routes
  await fastify.register(healthRoutes, { prefix: "/api" });
  await fastify.register(authRoutes, { prefix: "/api/auth" });

  // Global error handler
  fastify.setErrorHandler((error, request, reply) => {
    fastify.log.error(error);

    const isDevelopment = envConfig.NODE_ENV === "development";

    reply.status(500).send({
      success: false,
      error: isDevelopment ? error.message : "Internal Server Error",
      ...(isDevelopment && { stack: error.stack }),
    });
  });

  return fastify;
}

async function start() {
  try {
    const fastify = await buildServer();

    const host = envConfig.HOST;
    const port = Number.parseInt(envConfig.PORT, 10);

    await fastify.listen({ host, port });

    console.log(`🚀 Server running at http://${host}:${port}`);
    console.log(`📊 Health check: http://${host}:${port}/api/health`);
    console.log(`🔌 WebSocket: ws://${host}:${port}/ws`);
  } catch (err) {
    console.error("Error starting server:", err);
    process.exit(1);
  }
}

// Start the server
start();
