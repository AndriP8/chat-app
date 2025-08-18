export const API_BASE_URL = import.meta.env.API_URL || 'http://localhost:3001/api';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  details?: string;
  hasMore?: boolean; // For pagination in messages
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

export async function makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  // Default headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add existing headers
  if (options.headers) {
    Object.assign(headers, options.headers);
  }

  const config: RequestInit = {
    ...options,
    headers,
    credentials: 'include', // Include cookies in requests
  };

  try {
    const response = await fetch(url, config);

    // Parse response
    let data: ApiResponse<T>;
    try {
      data = await response.json();
    } catch {
      throw new ApiError('Invalid response format', response.status);
    }

    // Handle non-2xx responses
    if (!response.ok) {
      throw new ApiError(data.error || `HTTP ${response.status}`, response.status);
    }

    // Handle API-level errors
    if (!data.success) {
      throw new ApiError(data.error || 'Request failed', response.status);
    }

    return data as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ApiError('Network error - please check your connection', 0);
    }

    // Handle other errors
    throw new ApiError(error instanceof Error ? error.message : 'Unknown error', 0);
  }
}
