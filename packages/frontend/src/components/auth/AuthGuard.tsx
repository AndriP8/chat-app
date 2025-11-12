import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

interface AuthGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
  redirectTo?: string;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({
  children,
  fallback,
  redirectTo = '/login',
}) => {
  const { isAuthenticated, authState } = useAuth();
  const location = useLocation();

  if (authState.isLoading) {
    return (
      fallback || (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-blue-600" />
            <p className="text-gray-600 dark:text-gray-400">Loading...</p>
          </div>
        </div>
      )
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate to={redirectTo} state={{ from: location.pathname + location.search }} replace />
    );
  }

  return <>{children}</>;
};
