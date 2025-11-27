import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useReducer,
} from 'react';
import { type AuthState, authReducer, loadPersistedAuthState } from '@/reducers/authReducer';
import type { LoginInput, RegisterInput } from '@/schemas/auth';
import { clearAllLocalData, initializeDataSync, shutdownDataSync } from '@/services';
import { ApiError, authApi } from '@/services/api';
import type { User } from '@/types';
import { getErrorMessage, secureStorage } from '@/utils/helpers';

interface AuthContextType {
  authState: AuthState;
  login: (credentials: LoginInput) => Promise<void>;
  register: (userData: RegisterInput) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  isAuthenticated: boolean;
  currentUser: User | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [authState, dispatch] = useReducer(authReducer, loadPersistedAuthState());

  const login = useCallback(async (loginData: LoginInput): Promise<void> => {
    dispatch({ type: 'AUTH_LOGIN_START' });

    try {
      const response = await authApi.login(loginData);

      dispatch({
        type: 'AUTH_LOGIN_SUCCESS',
        payload: { user: response.data.user },
      });
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      dispatch({
        type: 'AUTH_LOGIN_FAILURE',
        payload: { error: errorMessage },
      });
      throw error;
    }
  }, []);

  const register = useCallback(async (userData: RegisterInput): Promise<void> => {
    dispatch({ type: 'AUTH_REGISTER_START' });

    try {
      const response = await authApi.register(userData);

      dispatch({
        type: 'AUTH_REGISTER_SUCCESS',
        payload: { user: response.data.user },
      });
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      dispatch({
        type: 'AUTH_REGISTER_FAILURE',
        payload: { error: errorMessage },
      });
      throw error;
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await authApi.logout();
    } finally {
      try {
        shutdownDataSync();
        await clearAllLocalData();
      } catch (error) {
        console.error('Error during data sync cleanup:', error);
      }

      secureStorage.remove('minimalUserData');
      dispatch({ type: 'AUTH_LOGOUT' });
    }
  }, []);

  const clearError = useCallback((): void => {
    dispatch({ type: 'AUTH_CLEAR_ERROR' });
  }, []);

  useEffect(() => {
    if (authState.isAuthenticated) {
      const validateAuth = async () => {
        try {
          const { data } = await authApi.getCurrentUser();
          dispatch({ type: 'SET_USER_DATA', payload: { user: data.user } });
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) {
            secureStorage.remove('minimalUserData');
            dispatch({ type: 'AUTH_LOGOUT' });
          } else {
            console.warn('Auth validation failed:', error);
          }
        }
      };

      validateAuth();
      const interval = setInterval(validateAuth, 15 * 60 * 1000); // Every 15 minutes

      return () => clearInterval(interval);
    }
  }, [authState.isAuthenticated]);

  // Data sync initialization effect
  useEffect(() => {
    if (authState.isAuthenticated && authState.user) {
      const initializeSync = async () => {
        try {
          await initializeDataSync({
            maxRetries: 3,
            baseDelayMs: 1000,
            maxDelayMs: 30000,
            currentUserId: authState.user!.id,
          });
        } catch (error) {
          console.error('Failed to initialize data synchronization:', error);
        }
      };

      initializeSync();
    }
  }, [authState.isAuthenticated, authState.user]);

  const contextValue: AuthContextType = {
    authState,
    login,
    register,
    logout,
    clearError,
    isAuthenticated: authState.isAuthenticated,
    currentUser: authState.user,
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};
