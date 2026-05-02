# 💬 Real-Time Chat Application

> **Production-Ready** | Offline-First Architecture | Real-Time WebSocket Messaging

A modern, full-stack 1:1 chat application demonstrating advanced real-time communication patterns, offline-first architecture, and production-grade engineering practices.

**🚀 [Live Demo](https://chat-app.andripurnomo.com/)** | **📊 [Architecture Diagram](./docs/images/chat-app-architecture.png)**

---

## ✨ Project Highlights

- ⚡ **Real-time messaging** with WebSocket and automatic reconnection
- 📱 **Offline-first architecture** with IndexedDB caching and background sync
- 🔄 **Cross-tab synchronization** using BroadcastChannel API
- 🎯 **Optimistic UI updates** for instant user feedback
- 🔁 **Intelligent retry logic** with exponential backoff (up to 5 retries)
- 📦 **Message ordering** with sequence numbers and server-side buffering
- ✅ **Comprehensive test coverage** with Vitest (14 test suites)
- 🚀 **Production deployment** with Vercel (frontend) + Fly.io (backend)
- 🔐 **Secure authentication** with JWT and HTTP-only cookies

---

## 🏗️ Architecture & Tech Stack

### Frontend
- **Framework:** React 19 with TypeScript
- **Styling:** Tailwind CSS 4
- **Build Tool:** Vite 7
- **State Management:** React Hooks + Reducers
- **Offline Storage:** IndexedDB (Dexie.js)
- **Real-time:** WebSocket client with auto-reconnect
- **PWA:** VitePWA + Workbox for offline capabilities
- **Virtualization:** TanStack Virtual for message lists
- **Testing:** Vitest + React Testing Library + fake-indexeddb

### Backend
- **Framework:** Fastify 5 with TypeScript
- **Database:** PostgreSQL 17
- **ORM:** Drizzle ORM with migrations
- **Real-time:** @fastify/websocket
- **Authentication:** JWT + bcrypt
- **Security:** Rate limiting, CORS, HTTP-only cookies
- **Testing:** Vitest with integration tests

### DevOps & Tools
- **Database:** Neon (PostgreSQL, managed)
- **CI/CD:** GitHub Actions (lint, type-check, e2e, deploy to Fly.io)
- **Code Quality:** Biome (linting + formatting)
- **Package Manager:** pnpm workspaces (monorepo)
- **Version Control:** Git with conventional commits

---

## 🎯 Key Features

### 🔒 Security & Authentication
- JWT-based authentication with HTTP-only cookies
- Bcrypt password hashing (configurable rounds)
- CORS protection with origin whitelisting
- Rate limiting on API endpoints
- Secure WebSocket authentication

### 💬 Core Messaging Features
- Real-time 1:1 messaging with WebSocket
- Message status tracking: `sending` → `sent` → `delivered` → `read` → `failed`
- Read receipts with visual indicators
- Draft message persistence with auto-save (1s debounce)
- Message ordering with client-side sequence numbers
- Server-side message buffering for out-of-order messages (5s gap timeout)

### 📴 Offline-First Architecture
- **IndexedDB caching** for messages, conversations, and user data
- **Optimistic UI updates** - instant feedback before server confirmation
- **Message queue** with automatic retry on reconnection
- **Background sync** using Service Worker Sync API
- **Cross-tab synchronization** via BroadcastChannel
- **PWA support** with offline asset caching

### 🚀 Performance & UX
- Virtual scrolling for long message lists (TanStack Virtual)
- Lazy loading of conversation history
- Automatic scroll position management
- Offline indicator with connection status
- PWA install prompt for mobile-like experience
- Automatic cleanup of failed/orphaned messages

### 🧪 Testing & Quality
- **14 test suites** covering critical paths
- Unit tests for services (WebSocket, IndexedDB, scheduler)
- Integration tests for API routes
- React component tests with Testing Library
- Mocked IndexedDB and WebSocket for deterministic tests
- CI pipeline with automated testing

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 22.0.0
- **pnpm** ≥ 8.0.0
- **Docker Desktop** (for PostgreSQL)

### Installation

```bash
# Clone the repository
git clone https://github.com/andrip8/chat-app.git
cd chat-app

# Install dependencies
pnpm install

# Start PostgreSQL database
pnpm db:start

# Run database migrations
cd packages/backend && pnpm db:push && cd ../..

# Start development servers (frontend + backend)
pnpm dev
```

### Access the Application

- **Frontend:** [http://localhost:5173](http://localhost:5173)
- **Backend API:** [http://localhost:3001](http://localhost:3001)
- **Health Check:** [http://localhost:3001/api/health](http://localhost:3001/api/health)

---

## 🚀 Deployment

### Frontend — Vercel

Deployed automatically on push to `main`. Configure in Vercel dashboard:

```env
VITE_API_BASE_URL=https://chat-app-backend-flyio.fly.dev
VITE_WS_URL=wss://chat-app-backend-flyio.fly.dev
```

### Backend — Fly.io

```bash
# First-time setup (from repo root)
flyctl launch --config packages/backend/fly.toml --no-deploy

# Set secrets
flyctl secrets set \
  DATABASE_URL="<neon-postgres-url>" \
  JWT_SECRET="<openssl rand -hex 32>" \
  BCRYPT_ROUNDS=12 \
  CORS_ORIGIN="https://chat-app.andripurnomo.com"

# Deploy manually
flyctl deploy --config packages/backend/fly.toml
```

Automatic deploys on push to `main` via GitHub Actions (requires `FLY_API_TOKEN` secret).

### Database — Neon

Free managed PostgreSQL at [neon.tech](https://neon.tech). After creating a project:

```bash
DATABASE_URL="<neon-url>" pnpm --filter @chat-app/backend db:push
```

---

## 📁 Project Structure

```
chat-app/
├── packages/
│   ├── frontend/                 # React application
│   │   ├── src/
│   │   │   ├── components/       # UI components
│   │   │   │   ├── auth/         # Login, registration
│   │   │   │   ├── chat/         # Message list, bubble, input
│   │   │   │   └── pwa/          # Install prompt, reload prompt
│   │   │   ├── hooks/            # Custom React hooks
│   │   │   │   ├── useWebSocketConversations.ts
│   │   │   │   └── usePWAInstall.ts
│   │   │   ├── services/         # Core business logic
│   │   │   │   ├── websocket.ts           # WebSocket client
│   │   │   │   ├── dataSyncer.ts          # Sync IndexedDB ↔ Server
│   │   │   │   ├── messageScheduler.ts    # Retry queue
│   │   │   │   ├── broadcastChannel.ts    # Cross-tab sync
│   │   │   │   ├── databaseOperations.ts  # IndexedDB CRUD
│   │   │   │   ├── draftMessageService.ts # Draft persistence
│   │   │   │   └── sequenceNumber.ts      # Message ordering
│   │   │   ├── reducers/         # State management
│   │   │   ├── types/            # TypeScript types
│   │   │   └── __tests__/        # Test suites
│   │   ├── public/               # Static assets, PWA icons
│   │   └── vite.config.ts        # Vite + PWA config
│   │
│   └── backend/                  # Fastify application
│       ├── src/
│       │   ├── routes/           # API endpoints
│       │   │   ├── auth.ts       # Login, register, logout
│       │   │   ├── conversations.ts  # Conversation CRUD
│       │   │   ├── websocket.ts  # WebSocket handlers
│       │   │   └── health.ts     # Health check
│       │   ├── services/         # Business logic
│       │   │   ├── messageOrderingService.ts  # Buffer out-of-order msgs
│       │   │   └── cleanupService.ts          # Periodic cleanup
│       │   ├── db/               # Database schema
│       │   │   └── schema.ts     # Drizzle schema
│       │   ├── middleware/       # Auth middleware
│       │   ├── utils/            # Helpers, transformers
│       │   └── __tests__/        # Test suites
│       └── drizzle/              # Database migrations
│
├── docs/                         # Documentation
│   ├── REQ-EXPLORATION.MD        # Requirements & architecture
│   └── images/                   # Architecture diagrams
│
├── .github/workflows/
│   └── ci.yml                    # Lint, type-check, e2e, deploy
│
├── Dockerfile                    # Backend container (Fly.io)
├── docker-compose.yml            # Local dev PostgreSQL only
├── vercel.json                   # Vercel monorepo config
└── pnpm-workspace.yaml           # Monorepo configuration
```

---

## 🧪 Testing & Quality

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run tests with UI
pnpm test:ui
```

### Test Coverage

| Package  | Test Suites | Coverage Areas                                      |
|----------|-------------|-----------------------------------------------------|
| Frontend | 9 suites    | WebSocket, IndexedDB, BroadcastChannel, Scheduler, Hooks |
| Backend  | 5 suites    | Auth, Conversations, WebSocket, Message Ordering    |

### Code Quality

```bash
# Lint all packages
pnpm lint

# Format code
pnpm format

# Type check
pnpm type-check
```

**Tools:**
- **Biome** for fast linting and formatting
- **TypeScript** strict mode for type safety
- **Vitest** for unit and integration testing
- **fake-indexeddb** for deterministic IndexedDB tests

---

## 📚 Documentation

- **[Requirements Exploration](./docs/REQ-EXPLORATION.MD)** - Detailed system design and architecture decisions
- **[Architecture Diagram](./docs/images/chat-app-architecture.png)** - Visual system overview
- **[Database Schema](./docs/images/chat-app-database.png)** - ER diagram

### Key Architecture Patterns

**Offline-First Flow:**
```
User Action → IndexedDB (instant UI update) → Message Scheduler → WebSocket → Server
                ↓
          BroadcastChannel (sync other tabs)
```

**Message Ordering:**
- Client assigns sequence numbers (1, 2, 3...)
- Server buffers out-of-order messages
- Delivers in sequence with 5-second gap timeout

**Retry Strategy:**
- Exponential backoff: 1s → 2s → 4s → 8s → 16s → 30s (max)
- Max 5 retries before marking as failed
- Automatic cleanup of orphaned messages

---

## 💡 Learning Outcomes

This project demonstrates proficiency in:

### Frontend Engineering
- ✅ Advanced React patterns (hooks, reducers, context)
- ✅ Real-time WebSocket client implementation
- ✅ IndexedDB for client-side data persistence
- ✅ Progressive Web App (PWA) development
- ✅ Optimistic UI updates and error handling
- ✅ Cross-tab communication with BroadcastChannel
- ✅ Virtual scrolling for performance optimization

### Backend Engineering
- ✅ RESTful API design with Fastify
- ✅ WebSocket server implementation
- ✅ Database design and migrations (Drizzle ORM)
- ✅ JWT authentication and security best practices
- ✅ Message ordering and buffering algorithms
- ✅ Background job scheduling (cleanup service)

### System Design
- ✅ Offline-first architecture patterns
- ✅ Message queue and retry mechanisms
- ✅ Handling network failures and edge cases
- ✅ Cross-device synchronization strategies
- ✅ Scalable real-time communication design

### DevOps & Tooling
- ✅ Cloud deployment with Vercel + Fly.io
- ✅ CI/CD pipeline with GitHub Actions
- ✅ Monorepo management with pnpm workspaces
- ✅ Automated testing and code quality checks
- ✅ Neon managed Postgres, environment secrets management

---

## 🛠️ Development

### Available Scripts

**Root:**
```bash
pnpm dev              # Run both frontend & backend in parallel
pnpm build            # Build all packages for production
pnpm lint             # Lint all packages with Biome
pnpm format           # Format code with Biome
pnpm type-check       # TypeScript type checking
pnpm test             # Run all tests
```

**Database (root):**
```bash
pnpm db:start         # Start PostgreSQL container
pnpm db:stop          # Stop PostgreSQL container
pnpm db:restart       # Restart PostgreSQL
pnpm db:logs          # View PostgreSQL logs
pnpm db:reset         # Reset database (⚠️ deletes all data)
pnpm db:shell         # Open PostgreSQL shell
```

**Backend (in `packages/backend/`):**
```bash
pnpm dev              # Start dev server with hot reload
pnpm build            # Build for production
pnpm start            # Start production server
pnpm db:push          # Push schema changes (development)
pnpm db:migrate       # Run migrations (production)
pnpm db:generate      # Generate migration files
pnpm db:studio        # Open Drizzle Studio (database GUI)
```

**Frontend (in `packages/frontend/`):**
```bash
pnpm dev              # Start Vite dev server
pnpm build            # Build for production
pnpm preview          # Preview production build
```

---

## 🌐 Environment Configuration

### Development

Default values work out of the box. No `.env` file needed for local development.

### Production

**Backend (Fly.io secrets):**
```bash
flyctl secrets set DATABASE_URL="..." JWT_SECRET="..." BCRYPT_ROUNDS=12 CORS_ORIGIN="https://chat-app.andripurnomo.com"
```

**Frontend (Vercel dashboard env vars):**
```
VITE_API_BASE_URL=https://chat-app-backend-flyio.fly.dev
VITE_WS_URL=wss://chat-app-backend-flyio.fly.dev
```

---

## 📈 CI/CD Pipeline

### GitHub Actions Workflows

**CI Pipeline** (`.github/workflows/ci.yml`) on push to `main`:
1. ✅ Lint with Biome
2. ✅ Type check with TypeScript
3. ✅ Build frontend and backend
4. ✅ Playwright E2E tests
5. 🚀 Deploy backend to Fly.io

Vercel deploys the frontend automatically via its own GitHub integration.

### Required GitHub Secrets

| Secret          | Description                          |
|-----------------|--------------------------------------|
| `FLY_API_TOKEN` | Fly.io deploy token (`flyctl tokens create deploy`) |

---

## 👤 Author

**Andri Purnomo**

- GitHub: [@andrip8](https://github.com/andrip8)
- Live Demo: [chat-app.andripurnomo.com](https://chat-app.andripurnomo.com/)

---

## 📄 License

MIT License - feel free to use this project for learning and portfolio purposes.

---

## 🙏 Acknowledgments

- Architecture inspired by [GreatFrontEnd's System Design course](https://www.greatfrontend.com/)
- Built as a demonstration of production-ready real-time application development
- Special thanks to the open-source community for the amazing tools and libraries

---
