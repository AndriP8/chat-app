// Export base utilities and types
export { ApiError, makeRequest, API_BASE_URL } from './base';
export type { ApiResponse } from './base';

// Import and export API modules
// API exports
import { authApi } from './auth';
import { conversationApi } from './conversations';

export { authApi, conversationApi };

// Export types
export type { AuthResponse, UserResponse, MessageResponse } from './types/auth';

// Main API object for convenience
export const api = {
  auth: authApi,
  conversations: conversationApi,
};

export default api;
