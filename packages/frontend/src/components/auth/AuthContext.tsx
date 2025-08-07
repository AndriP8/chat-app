import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import {
  authReducer,
  loadPersistedAuthState,
  type AuthState,
} from "@/reducers/authReducer";
import type { User } from "@/types";
import type { LoginInput, RegisterInput } from "@/schemas/auth";
import { getErrorMessage, secureStorage } from "@/utils/helpers";
import { authApi, ApiError } from "@/services/api";

interface AuthContextType {
  // State
  authState: AuthState;
  // Actions
  login: (credentials: LoginInput) => Promise<void>;
  register: (userData: RegisterInput) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  // Computed values
  isAuthenticated: boolean;
  currentUser: User | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authState, dispatch] = useReducer(
    authReducer,
    loadPersistedAuthState(),
  );

  // Login function
  const login = useCallback(async (loginData: LoginInput): Promise<void> => {
    dispatch({ type: "AUTH_LOGIN_START" });

    try {
      const response = await authApi.login(loginData);

      dispatch({
        type: "AUTH_LOGIN_SUCCESS",
        payload: { user: response.user },
      });
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      dispatch({
        type: "AUTH_LOGIN_FAILURE",
        payload: { error: errorMessage },
      });
      throw error; // Re-throw to allow component-level error handling
    }
  }, []);

  // Register function
  const register = useCallback(
    async (userData: RegisterInput): Promise<void> => {
      dispatch({ type: "AUTH_REGISTER_START" });

      try {
        const response = await authApi.register(userData);

        dispatch({
          type: "AUTH_REGISTER_SUCCESS",
          payload: { user: response.user },
        });
      } catch (error) {
        const errorMessage = getErrorMessage(error);
        dispatch({
          type: "AUTH_REGISTER_FAILURE",
          payload: { error: errorMessage },
        });
        throw error;
      }
    },
    [],
  );

  // Logout function
  const logout = useCallback(async (): Promise<void> => {
    try {
      await authApi.logout();
    } finally {
      secureStorage.remove("minimalUserData");
      dispatch({ type: "AUTH_LOGOUT" });
    }
  }, []);

  // Clear error function
  const clearError = useCallback((): void => {
    dispatch({ type: "AUTH_CLEAR_ERROR" });
  }, []);

  // Authentication validation effect
  useEffect(() => {
    if (authState.isAuthenticated) {
      const validateAuth = async () => {
        try {
          await authApi.getCurrentUser();
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) {
            secureStorage.remove("minimalUserData");
            dispatch({ type: "AUTH_LOGOUT" });
          } else {
            console.warn("Auth validation failed:", error);
          }
        }
      };

      validateAuth();
      const interval = setInterval(validateAuth, 15 * 60 * 1000); // Every 15 minutes

      return () => clearInterval(interval);
    }
  }, [authState.isAuthenticated]);

  // Computed values
  const isAuthenticated = authState.isAuthenticated;
  const currentUser = authState.user;

  const contextValue: AuthContextType = {
    authState,
    login,
    register,
    logout,
    clearError,
    isAuthenticated,
    currentUser,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
};
