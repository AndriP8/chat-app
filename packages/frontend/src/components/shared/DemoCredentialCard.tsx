import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DemoUser } from '@/services/api/types/auth';
import { useAuth } from '../auth/AuthContext';

interface DemoCredentialCardProps {
  users: DemoUser[];
  password: string;
  onClose?: () => void;
}

export const DemoCredentialCard = ({ users, password, onClose }: DemoCredentialCardProps) => {
  const [isLoggingIn, setIsLoggingIn] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (email: string) => {
    setIsLoggingIn(email);

    try {
      await login({ email, password });
      navigate('/chat', { replace: true });
    } catch (error) {
      console.error('Login failed:', error);
      setIsLoggingIn(null);
    }
  };

  const handleCopyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      setCopiedEmail(email);
      setTimeout(() => setCopiedEmail(null), 2000);
    } catch (error) {
      console.error('Failed to copy email:', error);
    }
  };

  return (
    <div className="w-full max-w-2xl rounded-lg border-2 border-green-200 bg-white p-6 shadow-lg dark:border-green-800 dark:bg-gray-800">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center font-semibold text-gray-900 text-lg dark:text-white">
          <svg
            className="mr-2 h-6 w-6 text-green-600 dark:text-green-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            role="img"
            aria-label="checkmark in a circle"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Demo Users Created Successfully!
        </h3>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              role="img"
              aria-label="close icon"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      <p className="mb-6 text-gray-600 text-sm dark:text-gray-400">
        Two demo accounts have been created. Choose one to login and start testing!
      </p>

      <div className="space-y-4">
        {users.map((user) => (
          <div
            key={user.id}
            className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900"
          >
            <div className="mb-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-semibold text-gray-900 dark:text-white">{user.name}</span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-gray-700 text-sm dark:text-gray-300">
                    📧 {user.email}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyEmail(user.email)}
                    className="cursor-pointer rounded px-2 py-1 text-blue-600 text-xs transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                  >
                    {copiedEmail === user.email ? '✓ Copied!' : 'Copy'}
                  </button>
                </div>

                <div className="text-gray-700 text-sm dark:text-gray-300">
                  <span className="font-mono">🔑 {password}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleLogin(user.email)}
              disabled={isLoggingIn !== null}
              className="w-full cursor-pointer rounded-lg bg-blue-600 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoggingIn === user.email ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Logging in...
                </span>
              ) : (
                `Login as ${user.name.split(' ')[0]}`
              )}
            </button>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
        <p className="flex items-start text-blue-800 text-sm dark:text-blue-200">
          <svg
            className="mr-2 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            role="img"
            aria-label="lightbulb tip icon"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>
            <strong>Tip:</strong> Open an incognito window and login as the other user to test
            real-time messaging between both accounts!
          </span>
        </p>
      </div>
    </div>
  );
};
