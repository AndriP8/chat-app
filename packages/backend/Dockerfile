# Build stage
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app

# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/backend/tsconfig.json ./packages/backend/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @chat-app/backend

# Copy backend source code
COPY packages/backend/src ./packages/backend/src
COPY packages/backend/drizzle.config.ts ./packages/backend/

# Build backend
RUN pnpm --filter @chat-app/backend build

# Production stage
FROM node:22-alpine

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10 --activate

# Set working directory
WORKDIR /app

# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/backend/package.json ./packages/backend/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod --filter @chat-app/backend

# Copy built application
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist

# Copy database migrations and configuration
COPY packages/backend/drizzle ./packages/backend/drizzle
COPY packages/backend/drizzle.config.ts ./packages/backend/

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Create logs directory and set ownership
RUN mkdir -p /app/logs && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Set environment
ENV NODE_ENV=production

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start the application
CMD ["node", "packages/backend/dist/src/index.js"]
