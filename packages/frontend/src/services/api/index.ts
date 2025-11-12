export type { ApiResponse } from './base';
export { API_BASE_URL, ApiError, makeRequest } from './base';

// Import and export API modules
// API exports
import { authApi } from './auth';
import { conversationApi } from './conversations';

export { authApi, conversationApi };

// Export types
export type { AuthResponse, MessageResponse, UserResponse } from './types/auth';

// Main API object for convenience
export const api = {
  auth: authApi,
  conversations: conversationApi,
};

export default api;
