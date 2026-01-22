/**
 * API Response Types
 * Shared between frontend and backend for type-safe API communication
 */

export interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
}

export interface ApiError {
  error: string;
  message: string;
  details?: unknown;
}
