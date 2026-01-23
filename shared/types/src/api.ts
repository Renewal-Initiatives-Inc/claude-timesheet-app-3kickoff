/**
 * API Response Types
 * Shared between frontend and backend for type-safe API communication
 */

import type { AgeBand, DocumentType, EmployeeDocument, SupervisorRequired, TaskCode, TaskCodeRate } from './db.js';

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
  | 'TOKEN_USED'
  | 'AGE_TOO_YOUNG';

// ============================================================================
// Employee Management Types
// ============================================================================

/**
 * Required documents based on employee age.
 */
export interface RequiredDocuments {
  parentalConsent: boolean;
  workPermit: boolean;
  safetyTraining: boolean;
  coppaDisclosure: boolean; // Required for ages 12-13
}

/**
 * Documentation status for an employee.
 */
export interface DocumentationStatus {
  isComplete: boolean;
  missingDocuments: DocumentType[];
  expiringDocuments: Array<{
    type: DocumentType;
    expiresAt: string;
    daysUntilExpiry: number;
  }>;
  hasValidConsent: boolean;
  hasValidWorkPermit: boolean | null; // null if not required
  safetyTrainingComplete: boolean;
}

/**
 * Employee with documentation status summary.
 */
export interface EmployeeWithDocStatus extends EmployeePublic {
  age: number;
  ageBand: AgeBand;
  documentation: {
    isComplete: boolean;
    missingCount: number;
    expiringCount: number;
  };
}

/**
 * Employee detail response with full documentation.
 */
export interface EmployeeDetailResponse {
  employee: EmployeeWithDocStatus;
  documents: EmployeeDocument[];
  requiredDocuments: RequiredDocuments;
  documentationStatus: DocumentationStatus;
}

/**
 * Employee list response.
 */
export interface EmployeeListResponse {
  employees: EmployeeWithDocStatus[];
}

/**
 * Employee update request.
 */
export interface UpdateEmployeeRequest {
  name?: string;
  email?: string;
}

/**
 * Employee update response.
 */
export interface UpdateEmployeeResponse {
  employee: EmployeePublic;
}

/**
 * Archive employee response.
 */
export interface ArchiveEmployeeResponse {
  message: string;
}

// ============================================================================
// Document Management Types
// ============================================================================

/**
 * Document upload request metadata.
 */
export interface DocumentUploadRequest {
  type: DocumentType;
  expiresAt?: string; // Required for work permits
}

/**
 * Document response.
 */
export interface DocumentResponse {
  document: EmployeeDocument;
}

/**
 * Document download URL response.
 */
export interface DocumentDownloadResponse {
  url: string;
  expiresAt: string;
}

/**
 * Document invalidation response.
 */
export interface DocumentInvalidateResponse {
  message: string;
}

// ============================================================================
// Dashboard Types
// ============================================================================

/**
 * Dashboard alert types.
 */
export type AlertType = 'missing_document' | 'expiring_document' | 'age_transition';

/**
 * Dashboard alert.
 */
export interface DashboardAlert {
  type: AlertType;
  employeeId: string;
  employeeName: string;
  message: string;
  dueDate?: string;
}

/**
 * Dashboard employees response.
 */
export interface DashboardEmployeesResponse {
  employees: EmployeeWithDocStatus[];
}

/**
 * Dashboard alerts response.
 */
export interface DashboardAlertsResponse {
  alerts: DashboardAlert[];
}

// ============================================================================
// Task Code Management Types
// ============================================================================

/**
 * Task code with its current effective rate.
 */
export interface TaskCodeWithCurrentRate extends TaskCode {
  currentRate: number;
}

/**
 * Task code detail with rate history.
 */
export interface TaskCodeDetailResponse {
  taskCode: TaskCodeWithCurrentRate & {
    rateHistory: TaskCodeRate[];
  };
}

/**
 * Task code list response.
 */
export interface TaskCodeListResponse {
  taskCodes: TaskCodeWithCurrentRate[];
  total: number;
}

/**
 * Create task code request.
 */
export interface CreateTaskCodeRequest {
  code: string;
  name: string;
  description?: string;
  isAgricultural: boolean;
  isHazardous: boolean;
  supervisorRequired: SupervisorRequired;
  minAgeAllowed: number;
  soloCashHandling: boolean;
  drivingRequired: boolean;
  powerMachinery: boolean;
  initialRate: number;
  rateEffectiveDate: string;
  rateJustificationNotes?: string;
}

/**
 * Update task code request.
 * Note: code field cannot be changed after creation.
 */
export interface UpdateTaskCodeRequest {
  name?: string;
  description?: string;
  isAgricultural?: boolean;
  isHazardous?: boolean;
  supervisorRequired?: SupervisorRequired;
  minAgeAllowed?: number;
  soloCashHandling?: boolean;
  drivingRequired?: boolean;
  powerMachinery?: boolean;
  isActive?: boolean; // For soft archive
}

/**
 * Add rate request.
 */
export interface AddRateRequest {
  hourlyRate: number;
  effectiveDate: string;
  justificationNotes?: string;
}

/**
 * Task code list query parameters.
 */
export interface TaskCodeListParams {
  isAgricultural?: 'true' | 'false';
  isHazardous?: 'true' | 'false';
  forAge?: number;
  includeInactive?: 'true' | 'false';
  search?: string;
}

/**
 * Task code error codes.
 */
export type TaskCodeErrorCode =
  | 'TASK_CODE_NOT_FOUND'
  | 'CODE_ALREADY_EXISTS'
  | 'INVALID_MIN_AGE'
  | 'RATE_NOT_FOUND'
  | 'INVALID_EFFECTIVE_DATE'
  | 'CODE_IMMUTABLE'
  | 'EMPLOYEE_NOT_FOUND';
