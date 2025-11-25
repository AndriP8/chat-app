import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';

type AuthMode = 'login' | 'register';

interface AuthPageProps {
  initialMode?: AuthMode;
}

export const AuthPage: React.FC<AuthPageProps> = ({ initialMode = 'login' }) => {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, authState } = useAuth();

  // Redirect authenticated users who directly access auth pages
  useEffect(() => {
    if (isAuthenticated && !authState.isLoading) {
      const from = (location.state as { from?: string })?.from || '/chat';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, authState.isLoading, navigate, location.state]);

  const handleAuthSuccess = useCallback(() => {
    setIsRedirecting(true);

    const from = (location.state as { from?: string })?.from || '/chat';

    setTimeout(() => {
      navigate(from, { replace: true });
    }, 500);
  }, [navigate, location.state]);

  const switchToLogin = useCallback(() => {
    setMode('login');
  }, []);

  const switchToRegister = useCallback(() => {
    setMode('register');
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-blue-50 to-indigo-100 p-4 dark:from-gray-900 dark:to-gray-800">
      {isRedirecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
            <div className="flex items-center space-x-3">
              <div className="h-6 w-6 animate-spin rounded-full border-blue-600 border-b-2" />
              <p className="font-medium text-gray-900 dark:text-white">Redirecting to chat...</p>
            </div>
          </div>
        </div>
      )}
      <div className="w-full max-w-md">
        {/* Logo/Brand Section */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-blue-600">
            <svg
              className="h-8 w-8 text-white"
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
          <h1 className="shrink-0 font-bold text-3xl text-gray-900 dark:text-white">ChatApp</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Connect and chat with friends in real-time
          </p>
        </div>

        {/* Auth Forms */}
        <div className="transition-all duration-300 ease-in-out">
          {mode === 'login' ? (
            <LoginForm onSwitchToRegister={switchToRegister} onLoginSuccess={handleAuthSuccess} />
          ) : (
            <RegisterForm onSwitchToLogin={switchToLogin} onRegisterSuccess={handleAuthSuccess} />
          )}
        </div>
      </div>
    </div>
  );
};
