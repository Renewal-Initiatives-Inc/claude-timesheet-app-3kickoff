import { useState, useCallback } from 'react';
import { ApiRequestError } from '../api/client.js';
import {
  getMyTimesheetHistoryReport,
  type TimesheetHistoryRecord,
  type TimesheetHistorySummary,
} from '../api/reports.js';
import { Breadcrumb } from '../components/Breadcrumb.js';
import { FinancialStatusBadge } from '../components/FinancialStatusBadge.js';
import './TimesheetHistoryReport.css';

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

export function MyTimesheetHistory() {
  const defaultRange = getDefaultDateRange();

  // Filter state (no employee filter - auto-filtered server-side)
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);
  const [status, setStatus] = useState<string>('');

  // Data state
  const [timesheets, setTimesheets] = useState<TimesheetHistoryRecord[]>([]);
  const [summary, setSummary] = useState<TimesheetHistorySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Expanded rows for notes
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Fetch timesheet history report
  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    setHasSearched(true);
    try {
      const response = await getMyTimesheetHistoryReport({
        startDate,
        endDate,
        status: (status as 'open' | 'submitted' | 'approved') || undefined,
      });
      setTimesheets(response.timesheets);
      setSummary(response.summary);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Failed to load timesheet history');
      }
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, status]);

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
      <Breadcrumb
        items={[
          { label: 'My Reports', href: '/my-reports' },
          { label: 'My Timesheet History' },
        ]}
      />
      <header className="timesheet-history-report-header">
        <h1>My Timesheet History</h1>
        <p className="timesheet-history-report-subtitle">
          View your submitted timesheets and their status
        </p>
      </header>

      {/* Filter Form - simplified without employee filter */}
      <form onSubmit={handleApplyFilters} className="timesheet-history-report-filters">
        <div className="filter-row">
          <div className="filter-field">
            <label htmlFor="startDate">Start Date</label>
            <input
              type="date"
              id="startDate"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              data-testid="my-timesheet-history-start-date"
            />
          </div>
          <div className="filter-field">
            <label htmlFor="endDate">End Date</label>
            <input
              type="date"
              id="endDate"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              data-testid="my-timesheet-history-end-date"
            />
          </div>
          <div className="filter-field">
            <label htmlFor="status">Status</label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              data-testid="my-timesheet-history-status-filter"
            >
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
            </select>
          </div>
          <div className="filter-actions">
            <button
              type="submit"
              className="apply-filters-button"
              disabled={loading}
              data-testid="my-timesheet-history-search-button"
            >
              {loading ? 'Loading...' : 'Search'}
            </button>
          </div>
        </div>
      </form>

      {/* Error Display */}
      {error && (
        <div className="timesheet-history-report-error" data-testid="error-my-timesheet-history">
          <p>{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="timesheet-history-report-loading">Loading your timesheet history...</div>
      )}

      {/* Results */}
      {!loading && hasSearched && (
        <>
          {/* Summary */}
          {summary && (
            <div className="timesheet-history-report-summary">
              <div className="summary-card" data-testid="my-timesheet-history-summary-total">
                <span className="summary-label">Total</span>
                <span className="summary-value">{summary.totalTimesheets}</span>
              </div>
              <div
                className="summary-card approved"
                data-testid="my-timesheet-history-summary-approved"
              >
                <span className="summary-label">Approved</span>
                <span className="summary-value">{getStatusCount('approved')}</span>
              </div>
              <div
                className="summary-card submitted"
                data-testid="my-timesheet-history-summary-submitted"
              >
                <span className="summary-label">Submitted</span>
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
                data-testid="my-timesheet-history-results-table"
              >
                <thead>
                  <tr>
                    <th></th>
                    <th>Week</th>
                    <th>Status</th>
                    <th className="numeric">Hours</th>
                    <th className="numeric">Earnings</th>
                    <th>Compliance</th>
                    <th>Financial</th>
                    <th>Reviewed</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {timesheets.map((ts) => (
                    <>
                      <tr key={ts.id} data-testid={`my-timesheet-history-row-${ts.id}`}>
                        <td>
                          <button
                            className="expand-button"
                            onClick={() => toggleRowExpansion(ts.id)}
                            aria-label={expandedRows.has(ts.id) ? 'Collapse' : 'Expand'}
                            data-testid={`my-timesheet-history-expand-button-${ts.id}`}
                          >
                            {expandedRows.has(ts.id) ? '−' : '+'}
                          </button>
                        </td>
                        <td className="week">{formatWeekRange(ts.weekStartDate)}</td>
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
                        <td>
                          <FinancialStatusBadge
                            timesheetId={ts.id}
                            timesheetStatus={ts.status}
                            compact
                          />
                        </td>
                        <td className="reviewed">{formatTimestamp(ts.reviewedAt)}</td>
                        <td>
                          <a href={`/timesheet/${ts.weekStartDate}`} className="view-link">
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
                              {ts.entries.length > 0 && (
                                <div className="detail-item entry-log">
                                  <strong>Entries:</strong>
                                  <table className="entry-log-table">
                                    <thead>
                                      <tr>
                                        <th>Date</th>
                                        <th>Task</th>
                                        <th>Time</th>
                                        <th>Hours</th>
                                        <th>Notes</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {ts.entries.map((entry, i) => (
                                        <tr key={i}>
                                          <td>{entry.workDate}</td>
                                          <td>{entry.taskCode} - {entry.taskName}</td>
                                          <td>{entry.startTime} - {entry.endTime}</td>
                                          <td>{parseFloat(entry.hours).toFixed(2)}</td>
                                          <td className="entry-notes-cell">{entry.notes || '-'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
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
          <p>Choose a start and end date, then click "Search" to view your timesheet history.</p>
        </div>
      )}
    </div>
  );
}
