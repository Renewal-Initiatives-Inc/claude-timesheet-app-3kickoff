import { useState, useCallback } from 'react';
import { getEmployees, ApiRequestError } from '../api/client.js';
import {
  getComplianceAuditReport,
  exportComplianceAuditCSV,
  type ComplianceAuditRecord,
  type ComplianceAuditSummary,
  type AgeBand,
  type ComplianceResultFilter,
} from '../api/reports.js';
import { Breadcrumb } from '../components/Breadcrumb.js';
import './ComplianceAuditReport.css';

/**
 * Format an ISO timestamp for display.
 */
function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format a date string as MM/DD/YYYY for display.
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });
}

/**
 * Get default date range (last 30 days).
 */
function getDefaultDateRange(): { startDate: string; endDate: string } {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return {
    startDate: thirtyDaysAgo.toISOString().split('T')[0]!,
    endDate: today.toISOString().split('T')[0]!,
  };
}

interface Employee {
  id: string;
  name: string;
}

export function ComplianceAuditReport() {
  const defaultRange = getDefaultDateRange();

  // Filter state
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);
  const [employeeId, setEmployeeId] = useState<string>('');
  const [ageBand, setAgeBand] = useState<string>('');
  const [result, setResult] = useState<string>('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesLoaded, setEmployeesLoaded] = useState(false);

  // Data state
  const [records, setRecords] = useState<ComplianceAuditRecord[]>([]);
  const [summary, setSummary] = useState<ComplianceAuditSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Expanded rows for details
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Export state
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

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

  // Fetch compliance audit report
  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    setHasSearched(true);
    try {
      const response = await getComplianceAuditReport({
        startDate,
        endDate,
        employeeId: employeeId || undefined,
        ageBand: (ageBand as AgeBand) || undefined,
        result: (result as ComplianceResultFilter) || undefined,
      });
      setRecords(response.records);
      setSummary(response.summary);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Failed to load compliance audit report');
      }
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, employeeId, ageBand, result]);

  // Handle export
  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const blob = await exportComplianceAuditCSV({
        startDate,
        endDate,
        employeeId: employeeId || undefined,
        ageBand: (ageBand as AgeBand) || undefined,
        result: (result as ComplianceResultFilter) || undefined,
      });

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance-audit-${startDate}-to-${endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setExportError(err.message);
      } else {
        setExportError('Failed to export compliance audit data');
      }
    } finally {
      setExporting(false);
    }
  };

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

  // Get result badge class
  const getResultClass = (resultValue: string) => {
    switch (resultValue) {
      case 'pass':
        return 'result-pass';
      case 'fail':
        return 'result-fail';
      default:
        return 'result-na';
    }
  };

  return (
    <div className="compliance-audit-report">
      <Breadcrumb
        items={[
          { label: 'Reports', href: '/reports' },
          { label: 'Compliance Audit Report' },
        ]}
      />
      <header className="compliance-audit-report-header">
        <h1>Compliance Audit Report</h1>
        <p className="compliance-audit-report-subtitle">
          View compliance check history and audit logs
        </p>
      </header>

      {/* Filter Form */}
      <form onSubmit={handleApplyFilters} className="compliance-audit-report-filters">
        <div className="filter-row">
          <div className="filter-field">
            <label htmlFor="startDate">Start Date</label>
            <input
              type="date"
              id="startDate"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              data-testid="compliance-audit-start-date"
            />
          </div>
          <div className="filter-field">
            <label htmlFor="endDate">End Date</label>
            <input
              type="date"
              id="endDate"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              data-testid="compliance-audit-end-date"
            />
          </div>
          <div className="filter-field">
            <label htmlFor="employeeId">Employee</label>
            <select
              id="employeeId"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              onFocus={loadEmployees}
              data-testid="compliance-audit-employee-filter"
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
            <label htmlFor="ageBand">Age Band</label>
            <select
              id="ageBand"
              value={ageBand}
              onChange={(e) => setAgeBand(e.target.value)}
              data-testid="compliance-audit-age-band-filter"
            >
              <option value="">All Ages</option>
              <option value="12-13">12-13</option>
              <option value="14-15">14-15</option>
              <option value="16-17">16-17</option>
              <option value="18+">18+</option>
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="result">Result</label>
            <select
              id="result"
              value={result}
              onChange={(e) => setResult(e.target.value)}
              data-testid="compliance-audit-result-filter"
            >
              <option value="">All Results</option>
              <option value="pass">Pass</option>
              <option value="fail">Fail</option>
              <option value="not_applicable">N/A</option>
            </select>
          </div>
          <div className="filter-actions">
            <button
              type="submit"
              className="apply-filters-button"
              disabled={loading}
              data-testid="compliance-audit-search-button"
            >
              {loading ? 'Loading...' : 'Search'}
            </button>
          </div>
        </div>
      </form>

      {/* Error Display */}
      {error && (
        <div className="compliance-audit-report-error" data-testid="error-compliance-audit">
          <p>{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="compliance-audit-report-loading">Loading compliance audit data...</div>
      )}

      {/* Results */}
      {!loading && hasSearched && (
        <>
          {/* Summary */}
          {summary && (
            <div className="compliance-audit-report-summary">
              <div className="summary-card" data-testid="compliance-audit-summary-total">
                <span className="summary-label">Total Checks</span>
                <span className="summary-value">{summary.totalChecks}</span>
              </div>
              <div className="summary-card pass" data-testid="compliance-audit-summary-pass">
                <span className="summary-label">Passed</span>
                <span className="summary-value">{summary.passCount}</span>
              </div>
              <div className="summary-card fail" data-testid="compliance-audit-summary-fail">
                <span className="summary-label">Failed</span>
                <span className="summary-value">{summary.failCount}</span>
              </div>
              <div className="summary-card na">
                <span className="summary-label">N/A</span>
                <span className="summary-value">{summary.notApplicableCount}</span>
              </div>
              <div className="summary-card">
                <span className="summary-label">Employees</span>
                <span className="summary-value">{summary.uniqueEmployees}</span>
              </div>
              <div className="summary-card">
                <span className="summary-label">Timesheets</span>
                <span className="summary-value">{summary.uniqueTimesheets}</span>
              </div>
            </div>
          )}

          {/* Export Button */}
          {records.length > 0 && (
            <div className="compliance-audit-report-actions">
              <button
                onClick={handleExport}
                disabled={exporting}
                className="export-button"
                data-testid="compliance-audit-export-csv"
              >
                {exporting ? 'Exporting...' : 'Download CSV'}
              </button>
              {exportError && <span className="export-error">{exportError}</span>}
            </div>
          )}

          {/* Results Table */}
          {records.length === 0 ? (
            <div className="compliance-audit-report-empty">
              <div className="empty-icon">&#128270;</div>
              <h2>No compliance checks found</h2>
              <p>Try adjusting your date range or filters.</p>
            </div>
          ) : (
            <div className="compliance-audit-report-content">
              <table
                className="compliance-audit-report-table"
                data-testid="compliance-audit-results-table"
              >
                <thead>
                  <tr>
                    <th></th>
                    <th>Timestamp</th>
                    <th>Employee</th>
                    <th>Age</th>
                    <th>Rule ID</th>
                    <th>Result</th>
                    <th>Week</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <>
                      <tr key={record.id} data-testid={`compliance-audit-row-${record.id}`}>
                        <td>
                          <button
                            className="expand-button"
                            onClick={() => toggleRowExpansion(record.id)}
                            aria-label={expandedRows.has(record.id) ? 'Collapse' : 'Expand'}
                            data-testid={`compliance-audit-expand-button-${record.id}`}
                          >
                            {expandedRows.has(record.id) ? '−' : '+'}
                          </button>
                        </td>
                        <td className="timestamp">{formatTimestamp(record.checkedAt)}</td>
                        <td className="employee-name">{record.employeeName}</td>
                        <td className="age">
                          {record.employeeAgeOnDate}
                          <span className="age-band">({record.ageBand})</span>
                        </td>
                        <td className="rule-id">{record.ruleId}</td>
                        <td>
                          <span className={`result-badge ${getResultClass(record.result)}`}>
                            {record.result === 'not_applicable' ? 'N/A' : record.result}
                          </span>
                        </td>
                        <td className="week">{formatDate(record.weekStartDate)}</td>
                        <td>
                          <a href={`/review/${record.timesheetId}`} className="view-link">
                            View Timesheet
                          </a>
                        </td>
                      </tr>
                      {expandedRows.has(record.id) && (
                        <tr key={`${record.id}-details`} className="details-row">
                          <td colSpan={8}>
                            <div className="details-content">
                              <div className="detail-item">
                                <strong>Rule:</strong> {record.details.ruleDescription}
                              </div>
                              {record.details.message && (
                                <div className="detail-item">
                                  <strong>Message:</strong> {record.details.message}
                                </div>
                              )}
                              {record.details.threshold !== undefined && (
                                <div className="detail-item">
                                  <strong>Threshold:</strong> {record.details.threshold}
                                </div>
                              )}
                              {record.details.actualValue !== undefined && (
                                <div className="detail-item">
                                  <strong>Actual:</strong> {record.details.actualValue}
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
        <div className="compliance-audit-report-empty">
          <div className="empty-icon">&#128202;</div>
          <h2>Select a date range</h2>
          <p>Choose a start and end date, then click "Search" to view compliance audit records.</p>
        </div>
      )}
    </div>
  );
}
