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

// ============================================================================
// Authentication Types
// ============================================================================

/**
 * Public employee information (no sensitive fields).
 */
export interface EmployeePublic {
  id: string;
  name: string;
  email: string;
  isSupervisor: boolean;
  dateOfBirth: string;
  status: 'active' | 'archived';
  createdAt: string;
}

/**
 * Login request payload.
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Login response with JWT token and employee info.
 */
export interface LoginResponse {
  token: string;
  employee: EmployeePublic;
}

/**
 * Register request payload (supervisor only).
 */
export interface RegisterRequest {
  name: string;
  email: string;
  dateOfBirth: string;
  isSupervisor?: boolean;
  tempPassword: string;
}

/**
 * Register response with created employee.
 */
export interface RegisterResponse {
  message: string;
  employee: EmployeePublic;
}

/**
 * Password reset request payload.
 */
export interface PasswordResetRequest {
  email: string;
}

/**
 * Password reset token validation request.
 */
export interface PasswordResetValidateRequest {
  token: string;
}

/**
 * Password reset token validation response.
 */
export interface PasswordResetValidateResponse {
  valid: boolean;
  email?: string;
}

/**
 * Password reset completion request.
 */
export interface PasswordResetCompleteRequest {
  token: string;
  newPassword: string;
}

/**
 * Current user response.
 */
export interface MeResponse {
  employee: EmployeePublic;
}

/**
 * Auth error codes.
 */
export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_LOCKED'
  | 'PASSWORD_TOO_WEAK'
  | 'EMAIL_EXISTS'
  | 'EMPLOYEE_NOT_FOUND'
  | 'INVALID_TOKEN'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_USED';
