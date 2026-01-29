import { ApiRequestError } from './client.js';

const API_BASE = '/api';

/**
 * Get the current auth token from localStorage
 */
function getAuthToken(): string | null {
  return localStorage.getItem('token');
}

/**
 * Make an authenticated API request
 */
async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: { ...headers, ...(options.headers as Record<string, string>) },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: 'Unknown error',
      message: response.statusText,
    }));

    throw new ApiRequestError(error.message || 'Request failed', response.status, error.error);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

// ============================================================================
// Types
// ============================================================================

export type AgeBand = '12-13' | '14-15' | '16-17' | '18+';
export type ComplianceResultFilter = 'pass' | 'fail' | 'not_applicable';

export interface ComplianceAuditFilters {
  startDate: string;
  endDate: string;
  employeeId?: string;
  ageBand?: AgeBand;
  result?: ComplianceResultFilter;
  ruleId?: string;
}

export interface ComplianceDetails {
  ruleDescription: string;
  checkedValues: Record<string, unknown>;
  threshold?: number | string;
  actualValue?: number | string;
  message?: string;
}

export interface ComplianceAuditRecord {
  id: string;
  timesheetId: string;
  ruleId: string;
  result: 'pass' | 'fail' | 'not_applicable';
  details: ComplianceDetails;
  checkedAt: string;
  employeeAgeOnDate: number;
  ageBand: AgeBand;
  employeeId: string;
  employeeName: string;
  weekStartDate: string;
}

export interface ComplianceAuditSummary {
  totalChecks: number;
  passCount: number;
  failCount: number;
  notApplicableCount: number;
  uniqueTimesheets: number;
  uniqueEmployees: number;
  ruleBreakdown: { ruleId: string; passCount: number; failCount: number }[];
}

export interface ComplianceAuditResponse {
  records: ComplianceAuditRecord[];
  summary: ComplianceAuditSummary;
}

export interface TimesheetHistoryFilters {
  startDate: string;
  endDate: string;
  employeeId?: string;
  status?: 'open' | 'submitted' | 'approved' | 'rejected';
  ageBand?: AgeBand;
}

export interface TimesheetHistoryRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  weekStartDate: string;
  status: string;
  totalHours: number;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  supervisorNotes: string | null;
  complianceCheckCount: number;
  complianceFailCount: number;
  totalEarnings: string | null;
}

export interface TimesheetHistorySummary {
  totalTimesheets: number;
  statusBreakdown: { status: string; count: number }[];
  totalHours: number;
  totalEarnings: number;
  employeeBreakdown: { employeeId: string; name: string; count: number }[];
}

export interface TimesheetHistoryResponse {
  timesheets: TimesheetHistoryRecord[];
  summary: TimesheetHistorySummary;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get compliance audit report with filters.
 */
export async function getComplianceAuditReport(
  filters: ComplianceAuditFilters
): Promise<ComplianceAuditResponse> {
  const params = new URLSearchParams();
  params.set('startDate', filters.startDate);
  params.set('endDate', filters.endDate);
  if (filters.employeeId) params.set('employeeId', filters.employeeId);
  if (filters.ageBand) params.set('ageBand', filters.ageBand);
  if (filters.result) params.set('result', filters.result);
  if (filters.ruleId) params.set('ruleId', filters.ruleId);

  return apiRequest(`/reports/compliance-audit?${params.toString()}`);
}

/**
 * Export compliance audit report as CSV.
 * Returns the CSV content as a Blob for download.
 */
export async function exportComplianceAuditCSV(filters: ComplianceAuditFilters): Promise<Blob> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/reports/compliance-audit/export`, {
    method: 'POST',
    headers,
    body: JSON.stringify(filters),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: 'Unknown error',
      message: response.statusText,
    }));

    throw new ApiRequestError(error.message || 'Export failed', response.status, error.error);
  }

  return response.blob();
}

/**
 * Get timesheet history report with filters.
 */
export async function getTimesheetHistoryReport(
  filters: TimesheetHistoryFilters
): Promise<TimesheetHistoryResponse> {
  const params = new URLSearchParams();
  params.set('startDate', filters.startDate);
  params.set('endDate', filters.endDate);
  if (filters.employeeId) params.set('employeeId', filters.employeeId);
  if (filters.status) params.set('status', filters.status);
  if (filters.ageBand) params.set('ageBand', filters.ageBand);

  return apiRequest(`/reports/timesheet-history?${params.toString()}`);
}
