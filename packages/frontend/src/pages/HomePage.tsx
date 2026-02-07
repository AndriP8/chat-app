import { useState } from 'react';
import { authApi } from '@/services';
import type { DemoUser } from '@/services/api/types/auth';
import { DemoCredentialCard } from '../components/shared/DemoCredentialCard';

interface DemoUsersResponse {
  users: DemoUser[];
  password: string;
  conversationId: string;
}

export const HomePage = () => {
  const [isCreatingDemo, setIsCreatingDemo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoUsers, setDemoUsers] = useState<DemoUsersResponse | null>(null);

  const handleTryDemo = async () => {
    setIsCreatingDemo(true);
    setError(null);

    try {
      const response = await authApi.generateDemoUser();

      if (response.data) {
        setDemoUsers(response.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create demo account');
    } finally {
      setIsCreatingDemo(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-linear-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header/Navigation */}
      <header className="border-gray-200 border-b bg-white/80 p-4 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600">
              <svg
                className="h-6 w-6 text-white"
                fill="none"
                stroke="currentColor"
                aria-label="Chat message icon"
                viewBox="0 0 24 24"
                role="img"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
            <span className="font-bold text-gray-900 text-xl dark:text-white">ChatApp</span>
          </div>
          <nav className="flex gap-3">
            <a
              href="/login"
              className="rounded-lg px-4 py-2 font-medium text-gray-700 text-sm transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Login
            </a>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex flex-1 flex-col">
        <section className="mx-auto flex max-w-7xl flex-1 flex-col items-center justify-center px-4 py-16 text-center">
          <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-blue-600">
            <svg
              className="h-10 w-10 text-white"
              fill="none"
              stroke="currentColor"
              aria-label="Chat message icon"
              viewBox="0 0 24 24"
              role="img"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>

          <h1 className="mb-4 font-bold text-5xl text-gray-900 md:text-6xl dark:text-white">
            Real-Time Chat Application
          </h1>

          <p className="mb-8 max-w-2xl text-gray-600 text-xl dark:text-gray-400">
            Technical demonstration of production-grade distributed systems architecture. Showcases
            offline-first design, eventual consistency patterns, real-time synchronization, and
            message ordering guarantees under network failures.
          </p>

          {/* CTA Buttons */}
          <div className="mb-12 flex flex-col gap-4 sm:flex-row">
            <button
              type="button"
              onClick={handleTryDemo}
              disabled={isCreatingDemo}
              className="group relative cursor-pointer overflow-hidden rounded-lg bg-blue-600 px-8 py-4 font-semibold text-lg text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCreatingDemo ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="h-5 w-5 animate-spin rounded-full border-white border-b-2" />
                  Creating Demo...
                </span>
              ) : (
                <>
                  Try Demo Instantly
                  <span className="ml-2 transition-transform group-hover:translate-x-1">→</span>
                </>
              )}
            </button>

            <a
              href={`https://github.com/${import.meta.env.VITE_GITHUB_USERNAME}/chat-app`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-lg border-2 border-gray-300 bg-white px-8 py-4 font-semibold text-gray-700 text-lg shadow-md transition-all hover:border-gray-400 hover:shadow-lg dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-500"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  clipRule="evenodd"
                />
              </svg>
              View on GitHub
            </a>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 max-w-md rounded-lg border-2 border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
              <p className="font-medium text-sm">{error}</p>
            </div>
          )}

          {/* Demo Credential Card */}
          {demoUsers && (
            <div className="mb-8">
              <DemoCredentialCard
                users={demoUsers.users}
                password={demoUsers.password}
                onClose={() => setDemoUsers(null)}
              />
            </div>
          )}

          {/* Disclaimer */}
          <div className="mb-12 max-w-2xl rounded-lg border-2 border-yellow-200 bg-yellow-50 p-6 text-left dark:border-yellow-800 dark:bg-yellow-900/20">
            <h3 className="mb-3 flex items-center font-semibold text-gray-900 text-lg dark:text-white">
              <svg
                className="mr-2 h-6 w-6 text-yellow-600 dark:text-yellow-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-label="Warning icon"
                role="img"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              Demo Account Notice
            </h3>
            <ul className="space-y-2 text-gray-700 text-sm dark:text-gray-300">
              <li className="flex items-start">
                <span className="mr-2 text-yellow-600 dark:text-yellow-400">•</span>
                Demo accounts are auto-generated (no email required)
              </li>
              <li className="flex items-start">
                <span className="mr-2 text-yellow-600 dark:text-yellow-400">•</span>
                All data is deleted after 24 hours of inactivity
              </li>
              <li className="flex items-start">
                <span className="mr-2 text-yellow-600 dark:text-yellow-400">•</span>
                This is a learning project, not a production application
              </li>
              <li className="flex items-start">
                <span className="mr-2 text-yellow-600 dark:text-yellow-400">•</span>
                Do not share sensitive information
              </li>
            </ul>
          </div>

          {/* Technical Highlights */}
          <div className="w-full max-w-4xl">
            <h2 className="mb-8 font-bold text-3xl text-gray-900 dark:text-white">
              Technical Highlights
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-lg border border-gray-200 bg-white p-6 text-left shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <h3 className="mb-2 font-semibold text-gray-900 text-lg dark:text-white">
                  Distributed State Management
                </h3>
                <p className="text-gray-600 text-sm dark:text-gray-400">
                  Solves the challenge of maintaining consistent state across client and server with
                  unreliable network. Implements optimistic updates with rollback mechanisms,
                  local-first data persistence (IndexedDB), and automatic retry queuing with
                  exponential backoff.
                </p>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-6 text-left shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <h3 className="mb-2 font-semibold text-gray-900 text-lg dark:text-white">
                  Real-Time Bidirectional Communication
                </h3>
                <p className="text-gray-600 text-sm dark:text-gray-400">
                  Full-duplex WebSocket communication with automatic reconnection, connection state
                  management, and graceful degradation. Implements delivery acknowledgments and read
                  receipts using event-driven architecture.
                </p>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-6 text-left shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <h3 className="mb-2 font-semibold text-gray-900 text-lg dark:text-white">
                  Causal Consistency & Message Ordering
                </h3>
                <p className="text-gray-600 text-sm dark:text-gray-400">
                  Implements sequence-number-based ordering to guarantee causally consistent message
                  delivery even when packets arrive out-of-order. Handles race conditions, network
                  partitions, and concurrent writes from multiple devices.
                </p>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-6 text-left shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <h3 className="mb-2 font-semibold text-gray-900 text-lg dark:text-white">
                  Multi-Tab State Synchronization
                </h3>
                <p className="text-gray-600 text-sm dark:text-gray-400">
                  Ensures data consistency across multiple browser tabs using shared IndexedDB
                  storage and BroadcastChannel API for inter-tab communication. Prevents duplicate
                  writes and race conditions in concurrent environments.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-gray-200 border-t bg-white/80 py-6 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/80">
          <div className="mx-auto max-w-7xl px-4 text-center">
            <p className="text-gray-500 text-sm dark:text-gray-400">
              Built as a learning project to demonstrate modern web development practices
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
};
