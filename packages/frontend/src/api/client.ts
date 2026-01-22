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
