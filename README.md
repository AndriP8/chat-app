# Real-Time Chat Application

A production-ready, real-time 1:1 chat application with offline-first architecture.

## Features

- Real-time messaging with WebSocket
- Offline-first with IndexedDB caching
- Optimistic UI updates for instant feedback
- Message ordering with sequence numbers
- Cross-tab synchronization (BroadcastChannel API)
- Message status tracking (sending, sent, delivered, read)
- Draft persistence with auto-save
- PWA with offline capabilities
- Automatic retry with exponential backoff
- JWT authentication (HTTP-only cookies)

## Tech Stack

**Frontend:** React 19 · TypeScript · Tailwind CSS 4 · Vite 7 · IndexedDB (Dexie) · VitePWA

**Backend:** Fastify 5 · TypeScript · PostgreSQL 17 · Drizzle ORM · WebSocket · JWT

**Infrastructure:** Docker · Docker Compose · GitHub Actions

## Quick Start

**Prerequisites:** Node.js ≥22 · pnpm ≥8 · Docker Desktop

```bash
# 1. Clone and install
git clone https://github.com/yourusername/chat-app.git
cd chat-app
pnpm install

# 2. Start PostgreSQL
pnpm db:start

# 3. Run migrations
cd packages/backend && pnpm db:push && cd ../..

# 4. Start development servers
pnpm dev
```

**Access:** Frontend at [http://localhost:5173](http://localhost:5173) · Backend at [http://localhost:3001](http://localhost:3001)

## Project Structure

```
chat-app/
├── packages/
│   ├── frontend/           # React application
│   │   ├── src/
│   │   │   ├── components/ # UI components
│   │   │   ├── hooks/      # Custom React hooks
│   │   │   ├── services/   # Core services (IndexedDB, WebSocket, sync)
│   │   │   └── types/      # TypeScript types
│   │   └── public/         # Static assets
│   └── backend/            # Fastify application
│       ├── src/
│       │   ├── routes/     # API routes
│       │   ├── services/   # Business logic
│       │   └── db/         # Database schema
│       └── drizzle/        # Migrations
├── docs/                   # Documentation
├── .github/workflows/      # CI/CD
└── docker-compose.yml      # Docker config
```

## Available Commands

**Development:**
```bash
pnpm dev              # Run both frontend & backend
pnpm build            # Build all packages
pnpm lint             # Lint all packages
pnpm type-check       # Type check all packages
```

**Backend-specific** (in `packages/backend/`):
```bash
pnpm db:push          # Push schema changes (dev)
pnpm db:migrate       # Run migrations (production)
pnpm db:generate      # Generate migrations
pnpm db:studio        # Open Drizzle Studio
```

## Deployment

**Quick Deploy:**
```bash
cp .env.example .env  # Configure production values
./deploy.sh           # Run deployment script
```

**Automated:** Push to `main` branch triggers GitHub Actions deployment to VPS.

## Architecture

**Offline-First Pattern** (cache-first, sync-later):

1. User action → Saved to IndexedDB
2. UI updates instantly (optimistic)
3. Message scheduler queues for sending
4. Server confirms with final IDs
5. BroadcastChannel syncs other tabs

**Data Flow:**
```
React UI → IndexedDB ← DataSyncer ↔ WebSocket ↔ Backend → PostgreSQL
              ↓
        BroadcastChannel (cross-tab sync)
```

**Message Ordering:** Client assigns sequence numbers (1, 2, 3...). Server buffers out-of-order messages and delivers in sequence with 5-second gap timeout.

## CI/CD

**GitHub Actions** auto-deploys on push to `main`:
1. SSH to VPS
2. Pull code & rebuild
3. Run migrations
4. Restart services
5. Health check

**Required GitHub Secrets:**
- `VPS_SSH_KEY` - Private SSH key
- `VPS_HOST` - VPS IP/domain
- `VPS_USER` - SSH username
- `APP_DIR` - Deploy directory

## Configuration

**Backend** (`packages/backend/.env`):
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/chat_app
JWT_SECRET=your-secret-key
CORS_ORIGIN=http://localhost:5173
```

**Frontend** (`packages/frontend/.env`):
```env
VITE_API_BASE_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
```

See `.env.example` for all options.

## License

MIT License
