import { useState, useCallback, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";
import { useAuth } from "./AuthContext";

type AuthMode = "login" | "register";

interface AuthPageProps {
  initialMode?: AuthMode;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  initialMode = "login",
}) => {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, authState } = useAuth();

  // Redirect authenticated users who directly access auth pages
  useEffect(() => {
    if (isAuthenticated && !authState.isLoading) {
      const from = (location.state as { from?: string })?.from || "/chat";
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, authState.isLoading, navigate, location.state]);

  const handleAuthSuccess = useCallback(() => {
    setIsRedirecting(true);

    const from = (location.state as { from?: string })?.from || "/chat";

    setTimeout(() => {
      navigate(from, { replace: true });
    }, 500);
  }, [navigate, location.state]);

  const switchToLogin = useCallback(() => {
    setMode("login");
  }, []);

  const switchToRegister = useCallback(() => {
    setMode("register");
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      {isRedirecting && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
              <p className="text-gray-900 dark:text-white font-medium">
                Redirecting to chat...
              </p>
            </div>
          </div>
        </div>
      )}
      <div className="w-full max-w-md">
        {/* Logo/Brand Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <svg
              className="w-8 h-8 text-white"
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            ChatApp
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Connect and chat with friends in real-time
          </p>
        </div>

        {/* Auth Forms */}
        <div className="transition-all duration-300 ease-in-out">
          {mode === "login" ? (
            <LoginForm
              onSwitchToRegister={switchToRegister}
              onLoginSuccess={handleAuthSuccess}
            />
          ) : (
            <RegisterForm
              onSwitchToLogin={switchToLogin}
              onRegisterSuccess={handleAuthSuccess}
            />
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            By continuing, you agree to our{" "}
            <button
              type="button"
              className="text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Terms of Service
            </button>{" "}
            and{" "}
            <button
              type="button"
              className="text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Privacy Policy
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export const LoginPage: React.FC = () => <AuthPage initialMode="login" />;

export const RegisterPage: React.FC = () => <AuthPage initialMode="register" />;
