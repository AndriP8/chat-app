# Build stage
FROM node:22-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8 --activate

# Set working directory
WORKDIR /app

# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/backend/package.json ./packages/backend/

# Install dependencies (includes drizzle-kit for migrations)
RUN pnpm install --frozen-lockfile --filter @chat-app/backend

# Copy backend source code
COPY packages/backend ./packages/backend

# Build backend
RUN cd packages/backend && pnpm build

# Production stage
FROM node:22-alpine

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8 --activate

# Set working directory
WORKDIR /app

# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/backend/package.json ./packages/backend/

# Install production dependencies + drizzle-kit for migrations
RUN pnpm install --frozen-lockfile --filter @chat-app/backend --prod
RUN pnpm add -w drizzle-kit

# Copy built application
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist

# Copy database migrations and configuration
COPY packages/backend/drizzle ./packages/backend/drizzle
COPY packages/backend/drizzle.config.ts ./packages/backend/
COPY packages/backend/src/db ./packages/backend/src/db

# Create logs directory
RUN mkdir -p /app/logs

# Set environment
ENV NODE_ENV=production

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start the application
CMD ["node", "packages/backend/dist/src/index.js"]
