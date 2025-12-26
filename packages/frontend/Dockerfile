# Build stage
FROM node:22-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10 --activate

# Set working directory
WORKDIR /app

# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/frontend/package.json ./packages/frontend/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @chat-app/frontend

# Copy frontend source code
COPY packages/frontend ./packages/frontend

# Build arguments for environment variables
ARG VITE_API_BASE_URL
ARG VITE_WS_URL

# Set environment variables for Vite build
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_WS_URL=${VITE_WS_URL}

# Build frontend with environment variables
RUN cd packages/frontend && pnpm build

# Production stage - Nginx to serve static files
FROM nginx:alpine

# Copy custom nginx configuration
COPY packages/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files from builder
COPY --from=builder /app/packages/frontend/dist /usr/share/nginx/html

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:80/health || exit 1

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
