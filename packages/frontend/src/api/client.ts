import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  EmployeePublic,
  EmployeeWithDocStatus,
  EmployeeDetailResponse,
  EmployeeListResponse,
  UpdateEmployeeRequest,
  DocumentationStatus,
  RequiredDocuments,
  DashboardAlertsResponse,
  EmployeeDocument,
  ApiError,
  TaskCodeWithCurrentRate,
  TaskCodeListResponse,
  TaskCodeDetailResponse,
  CreateTaskCodeRequest,
  UpdateTaskCodeRequest,
  AddRateRequest,
  TaskCodeListParams,
  TaskCodeRate,
  Timesheet,
  TimesheetWithEntries,
  TimesheetListResponse,
  TimesheetListParams,
  TimesheetEntry,
  CreateEntryRequest,
  UpdateEntryRequest,
  TimesheetTotals,
  WeekInfo,
} from '@renewal/types';

const API_BASE = '/api';

/**
 * Custom error for API calls
 */
export class ApiRequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

/**
 * Get the current auth token from localStorage
 */
function getAuthToken(): string | null {
  return localStorage.getItem('token');
}

/**
 * Set the auth token in localStorage
 */
export function setAuthToken(token: string): void {
  localStorage.setItem('token', token);
}

/**
 * Clear the auth token from localStorage
 */
export function clearAuthToken(): void {
  localStorage.removeItem('token');
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!getAuthToken();
}

/**
 * Make an authenticated API request
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {};

  // Copy existing headers
  if (options.headers) {
    const existingHeaders = options.headers as Record<string, string>;
    Object.assign(headers, existingHeaders);
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Only set Content-Type for non-FormData requests
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: 'Unknown error',
      message: response.statusText,
    })) as ApiError;

    throw new ApiRequestError(
      error.message || 'Request failed',
      response.status,
      error.error
    );
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

// ============================================================================
// Auth API
// ============================================================================

export async function login(data: LoginRequest): Promise<LoginResponse> {
  const response = await apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });

  setAuthToken(response.token);
  return response;
}

export async function logout(): Promise<void> {
  try {
    await apiRequest('/auth/logout', { method: 'POST' });
  } finally {
    clearAuthToken();
  }
}

export async function getCurrentUser(): Promise<{ employee: EmployeePublic }> {
  return apiRequest('/auth/me');
}

export async function registerEmployee(data: RegisterRequest): Promise<{
  message: string;
  employee: EmployeePublic;
  requiredDocuments: RequiredDocuments;
}> {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ============================================================================
// Employee API
// ============================================================================

export async function getEmployees(params?: {
  status?: 'active' | 'archived' | 'all';
  search?: string;
}): Promise<EmployeeListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.search) searchParams.set('search', params.search);

  const query = searchParams.toString();
  return apiRequest(`/employees${query ? `?${query}` : ''}`);
}

export async function getEmployee(id: string): Promise<EmployeeDetailResponse> {
  return apiRequest(`/employees/${id}`);
}

export async function updateEmployee(
  id: string,
  data: UpdateEmployeeRequest
): Promise<{ employee: EmployeePublic }> {
  return apiRequest(`/employees/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function archiveEmployee(id: string): Promise<{ message: string }> {
  return apiRequest(`/employees/${id}`, { method: 'DELETE' });
}

export async function getEmployeeDocuments(
  id: string
): Promise<{ documents: EmployeeDocument[] }> {
  return apiRequest(`/employees/${id}/documents`);
}

export async function getEmployeeDocumentationStatus(id: string): Promise<{
  documentationStatus: DocumentationStatus;
  requiredDocuments: RequiredDocuments;
}> {
  return apiRequest(`/employees/${id}/documentation-status`);
}

// ============================================================================
// Document API
// ============================================================================

export async function uploadDocument(
  employeeId: string,
  file: File,
  type: 'parental_consent' | 'work_permit' | 'safety_training',
  expiresAt?: string
): Promise<{ document: EmployeeDocument }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', type);
  if (expiresAt) {
    formData.append('expiresAt', expiresAt);
  }

  return apiRequest(`/employees/${employeeId}/documents`, {
    method: 'POST',
    body: formData,
  });
}

export async function markSafetyTrainingComplete(
  employeeId: string
): Promise<{ message: string; document: EmployeeDocument }> {
  return apiRequest(`/employees/${employeeId}/safety-training`, {
    method: 'POST',
  });
}

export async function getDocument(id: string): Promise<{ document: EmployeeDocument }> {
  return apiRequest(`/documents/${id}`);
}

export async function getDocumentDownloadUrl(
  id: string
): Promise<{ url: string; expiresAt: string }> {
  return apiRequest(`/documents/${id}/download`);
}

export async function invalidateDocument(id: string): Promise<{ message: string }> {
  return apiRequest(`/documents/${id}`, { method: 'DELETE' });
}

// ============================================================================
// Dashboard API
// ============================================================================

export async function getDashboardEmployees(): Promise<EmployeeListResponse> {
  return apiRequest('/dashboard/employees');
}

export async function getDashboardAlerts(): Promise<DashboardAlertsResponse> {
  return apiRequest('/dashboard/alerts');
}

export async function getDashboardStats(): Promise<{
  stats: {
    totalEmployees: number;
    completeDocumentation: number;
    missingDocumentation: number;
    expiringDocuments: number;
    byAgeBand: {
      '12-13': number;
      '14-15': number;
      '16-17': number;
      '18+': number;
    };
  };
}> {
  return apiRequest('/dashboard/stats');
}

// ============================================================================
// Task Code API
// ============================================================================

export async function getTaskCodes(
  params?: TaskCodeListParams
): Promise<TaskCodeListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.isAgricultural) searchParams.set('isAgricultural', params.isAgricultural);
  if (params?.isHazardous) searchParams.set('isHazardous', params.isHazardous);
  if (params?.forAge !== undefined) searchParams.set('forAge', params.forAge.toString());
  if (params?.includeInactive) searchParams.set('includeInactive', params.includeInactive);
  if (params?.search) searchParams.set('search', params.search);

  const query = searchParams.toString();
  return apiRequest(`/task-codes${query ? `?${query}` : ''}`);
}

export async function getTaskCode(id: string): Promise<TaskCodeDetailResponse> {
  return apiRequest(`/task-codes/${id}`);
}

export async function getTaskCodeByCode(
  code: string
): Promise<{ taskCode: TaskCodeWithCurrentRate }> {
  return apiRequest(`/task-codes/by-code/${code}`);
}

export async function createTaskCode(
  data: CreateTaskCodeRequest
): Promise<{ taskCode: TaskCodeWithCurrentRate }> {
  return apiRequest('/task-codes', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateTaskCode(
  id: string,
  data: UpdateTaskCodeRequest
): Promise<{ taskCode: TaskCodeWithCurrentRate }> {
  return apiRequest(`/task-codes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function addTaskCodeRate(
  id: string,
  data: AddRateRequest
): Promise<{ rate: TaskCodeRate }> {
  return apiRequest(`/task-codes/${id}/rates`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getTaskCodeRates(
  id: string
): Promise<{ rates: TaskCodeRate[] }> {
  return apiRequest(`/task-codes/${id}/rates`);
}

export async function getTaskCodesForEmployee(
  employeeId: string
): Promise<TaskCodeListResponse> {
  return apiRequest(`/task-codes/for-employee/${employeeId}`);
}

// ============================================================================
// Timesheet API
// ============================================================================

/**
 * Get list of employee's timesheets.
 */
export async function getTimesheets(
  params?: TimesheetListParams
): Promise<TimesheetListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.limit !== undefined) searchParams.set('limit', params.limit.toString());
  if (params?.offset !== undefined) searchParams.set('offset', params.offset.toString());

  const query = searchParams.toString();
  return apiRequest(`/timesheets${query ? `?${query}` : ''}`);
}

/**
 * Get or create timesheet for the current week.
 */
export async function getCurrentTimesheet(): Promise<TimesheetWithEntries> {
  return apiRequest('/timesheets/current');
}

/**
 * Get or create timesheet for a specific week.
 */
export async function getTimesheetByWeek(weekStartDate: string): Promise<TimesheetWithEntries> {
  return apiRequest(`/timesheets/week/${weekStartDate}`);
}

/**
 * Get timesheet by ID with entries.
 */
export async function getTimesheetById(id: string): Promise<TimesheetWithEntries> {
  return apiRequest(`/timesheets/${id}`);
}

/**
 * Create a new entry on a timesheet.
 */
export async function createTimesheetEntry(
  timesheetId: string,
  entry: CreateEntryRequest
): Promise<{ entry: TimesheetEntry }> {
  return apiRequest(`/timesheets/${timesheetId}/entries`, {
    method: 'POST',
    body: JSON.stringify(entry),
  });
}

/**
 * Update an entry on a timesheet.
 */
export async function updateTimesheetEntry(
  timesheetId: string,
  entryId: string,
  updates: UpdateEntryRequest
): Promise<{ entry: TimesheetEntry }> {
  return apiRequest(`/timesheets/${timesheetId}/entries/${entryId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

/**
 * Delete an entry from a timesheet.
 */
export async function deleteTimesheetEntry(
  timesheetId: string,
  entryId: string
): Promise<void> {
  return apiRequest(`/timesheets/${timesheetId}/entries/${entryId}`, {
    method: 'DELETE',
  });
}

/**
 * Get totals for a timesheet.
 */
export async function getTimesheetTotals(
  timesheetId: string
): Promise<TimesheetTotals> {
  return apiRequest(`/timesheets/${timesheetId}/totals`);
}

/**
 * Get week information for a timesheet.
 */
export async function getTimesheetWeekInfo(
  timesheetId: string
): Promise<WeekInfo> {
  return apiRequest(`/timesheets/${timesheetId}/week-info`);
}

/**
 * Compliance violation from the API.
 */
export interface ComplianceViolation {
  ruleId: string;
  ruleName: string;
  message: string;
  remediation: string;
  affectedDates?: string[];
  affectedEntries?: string[];
}

/**
 * Result of submitting a timesheet.
 */
export interface SubmitTimesheetResult {
  passed: boolean;
  message?: string;
  status?: string;
  violations?: ComplianceViolation[];
  summary?: {
    total: number;
    passed: number;
    failed: number;
    notApplicable: number;
  };
  complianceSummary?: {
    total: number;
    passed: number;
    notApplicable: number;
  };
}

/**
 * Result of validating a timesheet.
 */
export interface ValidateTimesheetResult {
  valid: boolean;
  violations: ComplianceViolation[];
}

/**
 * Submit a timesheet for compliance check and review.
 */
export async function submitTimesheet(
  timesheetId: string
): Promise<SubmitTimesheetResult> {
  try {
    return await apiRequest(`/timesheets/${timesheetId}/submit`, {
      method: 'POST',
    });
  } catch (error) {
    // Handle compliance check failures specially
    if (error instanceof ApiRequestError && error.status === 400) {
      // The response body should contain the compliance errors
      // Re-throw with parsed violations if present
      throw error;
    }
    throw error;
  }
}

/**
 * Validate a timesheet without submitting.
 */
export async function validateTimesheet(
  timesheetId: string
): Promise<ValidateTimesheetResult> {
  return apiRequest(`/timesheets/${timesheetId}/validate`, {
    method: 'POST',
  });
}

// ============================================================================
// Supervisor Review API
// ============================================================================

import type {
  ReviewQueueItem,
  TimesheetReviewData,
  ApproveTimesheetResponse,
  RejectTimesheetResponse,
  UnlockWeekResponse,
  ComplianceCheckLog,
} from '@renewal/types';

/**
 * Review queue response.
 */
export interface ReviewQueueResponse {
  items: ReviewQueueItem[];
  total: number;
}

/**
 * Get list of timesheets awaiting review.
 */
export async function getReviewQueue(params?: {
  employeeId?: string;
}): Promise<ReviewQueueResponse> {
  const searchParams = new URLSearchParams();
  if (params?.employeeId) searchParams.set('employeeId', params.employeeId);

  const query = searchParams.toString();
  return apiRequest(`/supervisor/review-queue${query ? `?${query}` : ''}`);
}

/**
 * Get count of timesheets pending review.
 */
export async function getPendingReviewCount(): Promise<{ count: number }> {
  return apiRequest('/supervisor/review-count');
}

/**
 * Get a timesheet for supervisor review with full details.
 */
export async function getTimesheetForReview(
  timesheetId: string
): Promise<TimesheetReviewData> {
  return apiRequest(`/supervisor/review/${timesheetId}`);
}

/**
 * Get compliance logs for a timesheet.
 */
export async function getComplianceLogs(
  timesheetId: string
): Promise<{ logs: ComplianceCheckLog[] }> {
  return apiRequest(`/supervisor/review/${timesheetId}/compliance`);
}

/**
 * Approve a submitted timesheet.
 */
export async function approveTimesheet(
  timesheetId: string,
  notes?: string
): Promise<ApproveTimesheetResponse> {
  return apiRequest(`/supervisor/review/${timesheetId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
}

/**
 * Reject a submitted timesheet.
 */
export async function rejectTimesheet(
  timesheetId: string,
  notes: string
): Promise<RejectTimesheetResponse> {
  return apiRequest(`/supervisor/review/${timesheetId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
}

/**
 * Unlock a historical week for an employee.
 */
export async function unlockWeek(
  employeeId: string,
  weekStartDate: string
): Promise<UnlockWeekResponse> {
  return apiRequest('/supervisor/unlock-week', {
    method: 'POST',
    body: JSON.stringify({ employeeId, weekStartDate }),
  });
}

// ============================================================================
// Payroll API
// ============================================================================

import type {
  PayrollRecord,
  PayrollRecordWithDetails,
  PayrollReportResponse,
  PayrollRecordResponse,
  PayrollRecalculateResponse,
  ApproveTimesheetWithPayrollResponse,
} from '@renewal/types';

/**
 * Get payroll record for a specific timesheet.
 */
export async function getPayrollRecord(
  timesheetId: string
): Promise<PayrollRecordResponse> {
  return apiRequest(`/payroll/timesheet/${timesheetId}`);
}

/**
 * Get payroll report with filters.
 */
export async function getPayrollReport(params: {
  startDate: string;
  endDate: string;
  employeeId?: string;
}): Promise<PayrollReportResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set('startDate', params.startDate);
  searchParams.set('endDate', params.endDate);
  if (params.employeeId) searchParams.set('employeeId', params.employeeId);

  return apiRequest(`/payroll/report?${searchParams.toString()}`);
}

/**
 * Export payroll records as CSV.
 * Returns the CSV content as a Blob for download.
 */
export async function exportPayrollCSV(params: {
  startDate: string;
  endDate: string;
  employeeId?: string;
}): Promise<Blob> {
  const token = getAuthToken();
  const headers: Record<string, string> = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  headers['Content-Type'] = 'application/json';

  const response = await fetch(`${API_BASE}/payroll/export`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: 'Unknown error',
      message: response.statusText,
    })) as ApiError;

    throw new ApiRequestError(
      error.message || 'Export failed',
      response.status,
      error.error
    );
  }

  return response.blob();
}

/**
 * Recalculate payroll for an approved timesheet.
 */
export async function recalculatePayroll(
  timesheetId: string
): Promise<PayrollRecalculateResponse> {
  return apiRequest(`/payroll/recalculate/${timesheetId}`, {
    method: 'POST',
  });
}

/**
 * Approve timesheet and get payroll result.
 * This is an enhanced version of approveTimesheet that includes payroll info.
 */
export async function approveTimesheetWithPayroll(
  timesheetId: string,
  notes?: string
): Promise<ApproveTimesheetWithPayrollResponse> {
  return apiRequest(`/supervisor/review/${timesheetId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
}
