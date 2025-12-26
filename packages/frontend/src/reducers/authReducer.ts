import type { User } from '@/types';
import { secureStorage } from '@/utils/helpers';

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export type AuthAction =
  | { type: 'AUTH_LOGIN_START' }
  | { type: 'AUTH_LOGIN_SUCCESS'; payload: { user: User } }
  | { type: 'AUTH_LOGIN_FAILURE'; payload: { error: string } }
  | { type: 'AUTH_LOGOUT' }
  | { type: 'AUTH_CLEAR_ERROR' }
  | { type: 'SET_USER_DATA'; payload: { user: User } };

const initialAuthState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

// Load persisted auth state from secure storage
export const loadPersistedAuthState = (): AuthState => {
  // Load minimal user data from secure storage
  const validUserData = secureStorage.get<MinimalUserData | null>('minimalUserData', null);

  if (validUserData) {
    // Reconstruct full user object for compatibility (missing fields will be null/undefined)
    const reconstructedUser: User = {
      id: validUserData.id,
      name: validUserData.name,
      email: '', // Will be fetched from server when needed
      profile_picture_url: validUserData.profilePictureUrl,
      created_at: new Date(), // Placeholder
      updated_at: new Date(), // Placeholder
    };

    return {
      ...initialAuthState,
      user: reconstructedUser,
      isAuthenticated: true,
    };
  }

  return initialAuthState;
};

interface MinimalUserData {
  id: string;
  name: string;
  profilePictureUrl?: string;
  is_demo?: boolean;
}

export function createMinimalUserData(user: User): MinimalUserData {
  return {
    id: user.id,
    name: user.name,
    profilePictureUrl: user.profile_picture_url,
    is_demo: user.is_demo,
  };
}

export const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'AUTH_LOGIN_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };

    case 'AUTH_LOGIN_SUCCESS': {
      // Store minimal user data in session storage
      const minimalUserData = createMinimalUserData(action.payload.user);
      secureStorage.set('minimalUserData', minimalUserData);

      return {
        ...state,
        user: action.payload.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };
    }

    case 'AUTH_LOGIN_FAILURE': {
      // Clear any persisted auth data on failure
      secureStorage.remove('minimalUserData');

      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload.error,
      };
    }

    case 'AUTH_LOGOUT': {
      // Clear all persisted auth data
      secureStorage.remove('minimalUserData');

      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      };
    }

    case 'AUTH_CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };

    case 'SET_USER_DATA': {
      // Store minimal user data in session storage
      const minimalUserData = createMinimalUserData(action.payload.user);
      secureStorage.set('minimalUserData', minimalUserData);

      return {
        ...state,
        user: action.payload.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };
    }
    default:
      return state;
  }
};
