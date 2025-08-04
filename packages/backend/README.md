# Chat App Backend

A Node.js backend API built with Fastify, Drizzle ORM, and PostgreSQL for the chat application.

## Tech Stack

- **Node.js** - Runtime environment
- **Fastify** - Fast and low overhead web framework
- **Drizzle ORM** - TypeScript ORM for PostgreSQL
- **PostgreSQL** - Database (local development)
- **Neon** - Serverless PostgreSQL for production
- **WebSocket** - Real-time communication
- **TypeScript** - Type safety

## Getting Started

### Prerequisites

- Node.js 22+ 
- pnpm 8+
- PostgreSQL (for local development)

### Installation

1. Install dependencies:
```bash
pnpm install
```

2. Set up environment variables:
```bash
cp .env.example .env
```

3. Update the `.env` file with your database credentials:
```env
DATABASE_URL=postgresql://username:password@localhost:5432/chat_app_dev
PORT=3001
HOST=localhost
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

### Database Setup

1. Create a PostgreSQL database:
```sql
CREATE DATABASE chat_app_dev;
```

2. Generate and run migrations:
```bash
pnpm db:generate
pnpm db:migrate
```

3. (Optional) Open Drizzle Studio to view your database:
```bash
pnpm db:studio
```

### Development

Start the development server:
```bash
pnpm dev
```

The server will start at `http://localhost:3001`

### Available Scripts

- `pnpm dev` - Start development server with hot reload
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run linter
- `pnpm format` - Format code
- `pnpm type-check` - Run TypeScript type checking
- `pnpm db:generate` - Generate database migrations
- `pnpm db:migrate` - Run database migrations
- `pnpm db:studio` - Open Drizzle Studio
- `pnpm db:push` - Push schema changes to database

### API Endpoints

- `GET /api/health` - Health check
- `GET /api/health/db` - Database health check
- `WS /ws` - WebSocket connection for real-time chat

### Production Deployment

For production, update your environment variables to use Neon:

```env
DATABASE_URL=postgresql://username:password@ep-xxx.us-east-1.aws.neon.tech/neondb
NODE_ENV=production
```

The application automatically detects Neon URLs and uses the appropriate database driver.

## Project Structure

```
src/
├── config/          # Configuration files
│   └── env.ts       # Environment schema
├── db/              # Database related files
│   ├── index.ts     # Database connection
│   └── schema.ts    # Drizzle schema definitions
├── routes/          # API routes
│   └── health.ts    # Health check routes
└── index.ts         # Main server file
```
