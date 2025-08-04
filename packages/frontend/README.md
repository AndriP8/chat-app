# Chat App Frontend

A modern React frontend for the chat application built with the latest technologies.

## Tech Stack

- **React 19** - Latest React with concurrent features
- **TypeScript** - Type-safe JavaScript
- **Vite** - Fast build tool and dev server
- **Tailwind CSS v4** - Utility-first CSS framework (latest beta)
- **pnpm** - Fast, disk space efficient package manager

## Development

### Prerequisites

- Node.js >= 22.0.0 (recommended)
- pnpm >= 8.0.0

### Getting Started

From the project root:

```bash
# Install dependencies
pnpm install

# Start development server
pnpm run dev --filter @chat-app/frontend

# Or from this directory
cd packages/frontend
pnpm run dev
```

The development server will start at `http://localhost:5173/`

### Available Scripts

- `pnpm run dev` - Start development server
- `pnpm run build` - Build for production
- `pnpm run preview` - Preview production build
- `pnpm run lint` - Lint code with Biome
- `pnpm run format` - Format code with Biome
- `pnpm run type-check` - Type check with TypeScript

## Features

- ⚡ **Fast Development** - Vite HMR for instant updates
- 🎨 **Modern Styling** - Tailwind CSS v4 with dark mode support
- 📱 **Responsive Design** - Mobile-first approach
- 🔧 **Type Safety** - Full TypeScript support
- 🧹 **Code Quality** - Biome for linting and formatting
- 🏗️ **Monorepo Ready** - Part of pnpm workspace

## Project Structure

```
src/
├── assets/          # Static assets
├── components/      # Reusable components (to be added)
├── pages/          # Page components (to be added)
├── hooks/          # Custom React hooks (to be added)
├── utils/          # Utility functions (to be added)
├── types/          # TypeScript type definitions (to be added)
├── App.tsx         # Main App component
├── main.tsx        # Application entry point
└── index.css       # Global styles with Tailwind
```

