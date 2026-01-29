import { useState, useCallback } from 'react';
import { getEmployees, ApiRequestError } from '../api/client.js';
import {
  getTimesheetHistoryReport,
  type TimesheetHistoryRecord,
  type TimesheetHistorySummary,
  type AgeBand,
} from '../api/reports.js';
import './TimesheetHistoryReport.css';

/**
 * Format a date string as MM/DD/YYYY for display.
 */
function _formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });
}

/**
 * Format a week range for display.
 */
function formatWeekRange(weekStartDate: string): string {
  const start = new Date(weekStartDate + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  const startStr = start.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' });
  const endStr = end.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' });
  return `${startStr} - ${endStr}`;
}

/**
 * Format an ISO timestamp for display.
 */
function formatTimestamp(isoString: string | null): string {
  if (!isoString) return '-';
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });
}

/**
 * Format currency value.
 */
function formatCurrency(value: string | null): string {
  if (!value) return '-';
  return `$${parseFloat(value).toFixed(2)}`;
}

/**
 * Get default date range (last 90 days).
 */
function getDefaultDateRange(): { startDate: string; endDate: string } {
  const today = new Date();
  const ninetyDaysAgo = new Date(today);
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  return {
    startDate: ninetyDaysAgo.toISOString().split('T')[0]!,
    endDate: today.toISOString().split('T')[0]!,
  };
}

interface Employee {
  id: string;
  name: string;
}

export function TimesheetHistoryReport() {
  const defaultRange = getDefaultDateRange();

  // Filter state
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);
  const [employeeId, setEmployeeId] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [ageBand, setAgeBand] = useState<string>('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesLoaded, setEmployeesLoaded] = useState(false);

  // Data state
  const [timesheets, setTimesheets] = useState<TimesheetHistoryRecord[]>([]);
  const [summary, setSummary] = useState<TimesheetHistorySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Expanded rows for notes
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Load employees for filter dropdown
  const loadEmployees = useCallback(async () => {
    if (employeesLoaded) return;
    try {
      const response = await getEmployees({ status: 'all' });
      setEmployees(response.employees.map((e) => ({ id: e.id, name: e.name })));
      setEmployeesLoaded(true);
    } catch (err) {
      console.error('Failed to load employees:', err);
    }
  }, [employeesLoaded]);

  // Fetch timesheet history report
  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    setHasSearched(true);
    try {
      const response = await getTimesheetHistoryReport({
        startDate,
        endDate,
        employeeId: employeeId || undefined,
        status: (status as 'open' | 'submitted' | 'approved' | 'rejected') || undefined,
        ageBand: (ageBand as AgeBand) || undefined,
      });
      setTimesheets(response.timesheets);
      setSummary(response.summary);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Failed to load timesheet history report');
      }
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, employeeId, status, ageBand]);

  // Handle filter form submission
  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    fetchReport();
  };

  // Toggle row expansion
  const toggleRowExpansion = (id: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Get status badge class
  const getStatusClass = (statusValue: string) => {
    switch (statusValue) {
      case 'approved':
        return 'status-approved';
      case 'rejected':
        return 'status-rejected';
      case 'submitted':
        return 'status-submitted';
      default:
        return 'status-open';
    }
  };

  // Get status count from summary
  const getStatusCount = (statusName: string): number => {
    if (!summary) return 0;
    const item = summary.statusBreakdown.find((s) => s.status === statusName);
    return item?.count ?? 0;
  };

  return (
    <div className="timesheet-history-report">
      <header className="timesheet-history-report-header">
        <h1>Timesheet History Report</h1>
        <p className="timesheet-history-report-subtitle">
          View historical timesheet status and review information
        </p>
      </header>

      {/* Filter Form */}
      <form onSubmit={handleApplyFilters} className="timesheet-history-report-filters">
        <div className="filter-row">
          <div className="filter-field">
            <label htmlFor="startDate">Start Date</label>
            <input
              type="date"
              id="startDate"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              data-testid="timesheet-history-start-date"
            />
          </div>
          <div className="filter-field">
            <label htmlFor="endDate">End Date</label>
            <input
              type="date"
              id="endDate"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              data-testid="timesheet-history-end-date"
            />
          </div>
          <div className="filter-field">
            <label htmlFor="employeeId">Employee</label>
            <select
              id="employeeId"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              onFocus={loadEmployees}
              data-testid="timesheet-history-employee-filter"
            >
              <option value="">All Employees</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="status">Status</label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              data-testid="timesheet-history-status-filter"
            >
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="ageBand">Age Band</label>
            <select
              id="ageBand"
              value={ageBand}
              onChange={(e) => setAgeBand(e.target.value)}
              data-testid="timesheet-history-age-band-filter"
            >
              <option value="">All Ages</option>
              <option value="12-13">12-13</option>
              <option value="14-15">14-15</option>
              <option value="16-17">16-17</option>
              <option value="18+">18+</option>
            </select>
          </div>
          <div className="filter-actions">
            <button
              type="submit"
              className="apply-filters-button"
              disabled={loading}
              data-testid="timesheet-history-search-button"
            >
              {loading ? 'Loading...' : 'Search'}
            </button>
          </div>
        </div>
      </form>

      {/* Error Display */}
      {error && (
        <div className="timesheet-history-report-error" data-testid="error-timesheet-history">
          <p>{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="timesheet-history-report-loading">Loading timesheet history...</div>
      )}

      {/* Results */}
      {!loading && hasSearched && (
        <>
          {/* Summary */}
          {summary && (
            <div className="timesheet-history-report-summary">
              <div className="summary-card" data-testid="timesheet-history-summary-total">
                <span className="summary-label">Total</span>
                <span className="summary-value">{summary.totalTimesheets}</span>
              </div>
              <div
                className="summary-card approved"
                data-testid="timesheet-history-summary-approved"
              >
                <span className="summary-label">Approved</span>
                <span className="summary-value">{getStatusCount('approved')}</span>
              </div>
              <div
                className="summary-card rejected"
                data-testid="timesheet-history-summary-rejected"
              >
                <span className="summary-label">Rejected</span>
                <span className="summary-value">{getStatusCount('rejected')}</span>
              </div>
              <div className="summary-card submitted">
                <span className="summary-label">Pending</span>
                <span className="summary-value">{getStatusCount('submitted')}</span>
              </div>
              <div className="summary-card">
                <span className="summary-label">Total Hours</span>
                <span className="summary-value">{summary.totalHours.toFixed(2)}</span>
              </div>
              <div className="summary-card total">
                <span className="summary-label">Earnings</span>
                <span className="summary-value">${summary.totalEarnings.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Results Table */}
          {timesheets.length === 0 ? (
            <div className="timesheet-history-report-empty">
              <div className="empty-icon">&#128203;</div>
              <h2>No timesheets found</h2>
              <p>Try adjusting your date range or filters.</p>
            </div>
          ) : (
            <div className="timesheet-history-report-content">
              <table
                className="timesheet-history-report-table"
                data-testid="timesheet-history-results-table"
              >
                <thead>
                  <tr>
                    <th></th>
                    <th>Week</th>
                    <th>Employee</th>
                    <th>Status</th>
                    <th className="numeric">Hours</th>
                    <th className="numeric">Earnings</th>
                    <th>Compliance</th>
                    <th>Reviewed</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {timesheets.map((ts) => (
                    <>
                      <tr key={ts.id} data-testid={`timesheet-history-row-${ts.id}`}>
                        <td>
                          {(ts.supervisorNotes || ts.complianceFailCount > 0) && (
                            <button
                              className="expand-button"
                              onClick={() => toggleRowExpansion(ts.id)}
                              aria-label={expandedRows.has(ts.id) ? 'Collapse' : 'Expand'}
                              data-testid={`timesheet-history-expand-button-${ts.id}`}
                            >
                              {expandedRows.has(ts.id) ? '−' : '+'}
                            </button>
                          )}
                        </td>
                        <td className="week">{formatWeekRange(ts.weekStartDate)}</td>
                        <td className="employee-name">{ts.employeeName}</td>
                        <td>
                          <span className={`status-badge ${getStatusClass(ts.status)}`}>
                            {ts.status}
                          </span>
                        </td>
                        <td className="numeric">{ts.totalHours.toFixed(2)}</td>
                        <td className="numeric">{formatCurrency(ts.totalEarnings)}</td>
                        <td>
                          {ts.complianceFailCount > 0 ? (
                            <span className="compliance-issues">
                              {ts.complianceFailCount} issue
                              {ts.complianceFailCount !== 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className="compliance-ok">OK</span>
                          )}
                        </td>
                        <td className="reviewed">{formatTimestamp(ts.reviewedAt)}</td>
                        <td>
                          <a href={`/review/${ts.id}`} className="view-link">
                            View
                          </a>
                        </td>
                      </tr>
                      {expandedRows.has(ts.id) && (
                        <tr key={`${ts.id}-details`} className="details-row">
                          <td colSpan={9}>
                            <div className="details-content">
                              {ts.supervisorNotes && (
                                <div className="detail-item notes">
                                  <strong>Supervisor Notes:</strong> {ts.supervisorNotes}
                                </div>
                              )}
                              {ts.complianceFailCount > 0 && (
                                <div className="detail-item compliance">
                                  <strong>Compliance:</strong> {ts.complianceFailCount} of{' '}
                                  {ts.complianceCheckCount} checks failed
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Initial State */}
      {!loading && !hasSearched && (
        <div className="timesheet-history-report-empty">
          <div className="empty-icon">&#128197;</div>
          <h2>Select a date range</h2>
          <p>Choose a start and end date, then click "Search" to view timesheet history.</p>
        </div>
      )}
    </div>
  );
}
