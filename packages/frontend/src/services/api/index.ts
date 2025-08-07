// Export base utilities and types
export { ApiError, makeRequest, API_BASE_URL } from "./base";
export type { ApiResponse } from "./base";

// Import and export API modules
import { authApi } from "./auth";

export { authApi };

// Export types
export type { AuthResponse, UserResponse, MessageResponse } from "./types/auth";

// Main API object for convenience
export const api = {
  auth: authApi,
};

export default api;
