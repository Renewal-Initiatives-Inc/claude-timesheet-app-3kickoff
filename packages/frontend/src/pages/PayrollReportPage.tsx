import { useState, useCallback } from 'react';
import type { PayrollRecordWithDetails, PayrollReportSummary } from '@renewal/types';
import {
  getPayrollReport,
  exportPayrollCSV,
  getEmployees,
  ApiRequestError,
  type AgeBand,
} from '../api/client.js';
import './PayrollReportPage.css';

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
 * Format currency value.
 */
function formatCurrency(value: string): string {
  return `$${parseFloat(value).toFixed(2)}`;
}

/**
 * Format hours value.
 */
function formatHours(value: string): string {
  return parseFloat(value).toFixed(2);
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

export function PayrollReportPage() {
  const defaultRange = getDefaultDateRange();

  // Filter state
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);
  const [employeeId, setEmployeeId] = useState<string>('');
  const [ageBand, setAgeBand] = useState<string>('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesLoaded, setEmployeesLoaded] = useState(false);

  // Data state
  const [records, setRecords] = useState<PayrollRecordWithDetails[]>([]);
  const [summary, setSummary] = useState<PayrollReportSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Export state
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Load employees for filter dropdown
  const loadEmployees = useCallback(async () => {
    if (employeesLoaded) return;
    try {
      const response = await getEmployees({ status: 'active' });
      setEmployees(response.employees.map((e) => ({ id: e.id, name: e.name })));
      setEmployeesLoaded(true);
    } catch (err) {
      console.error('Failed to load employees:', err);
    }
  }, [employeesLoaded]);

  // Fetch payroll report
  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    setHasSearched(true);
    try {
      const response = await getPayrollReport({
        startDate,
        endDate,
        employeeId: employeeId || undefined,
        ageBand: (ageBand as AgeBand) || undefined,
      });
      setRecords(response.records);
      setSummary(response.summary);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Failed to load payroll report');
      }
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, employeeId, ageBand]);

  // Handle export
  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const blob = await exportPayrollCSV({
        startDate,
        endDate,
        employeeId: employeeId || undefined,
        ageBand: (ageBand as AgeBand) || undefined,
      });

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payroll-export-${startDate}-to-${endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setExportError(err.message);
      } else {
        setExportError('Failed to export payroll data');
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

  return (
    <div className="payroll-report">
      <header className="payroll-report-header">
        <h1>Payroll Reports</h1>
        <p className="payroll-report-subtitle">
          View and export payroll calculations for approved timesheets
        </p>
      </header>

      {/* Filter Form */}
      <form onSubmit={handleApplyFilters} className="payroll-report-filters">
        <div className="filter-row">
          <div className="filter-field">
            <label htmlFor="startDate">Start Date</label>
            <input
              type="date"
              id="startDate"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              data-testid="payroll-report-start-date"
            />
          </div>
          <div className="filter-field">
            <label htmlFor="endDate">End Date</label>
            <input
              type="date"
              id="endDate"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              data-testid="payroll-report-end-date"
            />
          </div>
          <div className="filter-field">
            <label htmlFor="employeeId">Employee</label>
            <select
              id="employeeId"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              onFocus={loadEmployees}
              data-testid="payroll-report-employee-filter"
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
              data-testid="payroll-report-age-band-filter"
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
              data-testid="payroll-report-apply-filters"
            >
              {loading ? 'Loading...' : 'Apply Filters'}
            </button>
          </div>
        </div>
      </form>

      {/* Error Display */}
      {error && (
        <div className="payroll-report-error" data-testid="error-payroll-report">
          <p>{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="payroll-report-loading" data-testid="payroll-report-loading">
          Loading payroll data...
        </div>
      )}

      {/* Results */}
      {!loading && hasSearched && (
        <>
          {/* Summary */}
          {summary && (
            <div className="payroll-report-summary">
              <div className="summary-card">
                <span className="summary-label">Records</span>
                <span className="summary-value">{summary.totalRecords}</span>
              </div>
              <div className="summary-card">
                <span className="summary-label">Ag Hours</span>
                <span className="summary-value">{formatHours(summary.totalAgriculturalHours)}</span>
              </div>
              <div className="summary-card">
                <span className="summary-label">Non-Ag Hours</span>
                <span className="summary-value">
                  {formatHours(summary.totalNonAgriculturalHours)}
                </span>
              </div>
              <div className="summary-card">
                <span className="summary-label">OT Hours</span>
                <span className="summary-value">{formatHours(summary.totalOvertimeHours)}</span>
              </div>
              <div className="summary-card total">
                <span className="summary-label">Total Earnings</span>
                <span className="summary-value" data-testid="payroll-report-total-earnings">
                  {formatCurrency(summary.totalEarnings)}
                </span>
              </div>
            </div>
          )}

          {/* Export Button */}
          {records.length > 0 && (
            <div className="payroll-report-actions">
              <button
                onClick={handleExport}
                disabled={exporting}
                className="export-button"
                data-testid="payroll-report-export-csv"
              >
                {exporting ? 'Exporting...' : 'Download CSV'}
              </button>
              {exportError && <span className="export-error">{exportError}</span>}
            </div>
          )}

          {/* Results Table */}
          {records.length === 0 ? (
            <div className="payroll-report-empty">
              <div className="empty-icon">&#128202;</div>
              <h2>No payroll records found</h2>
              <p>Try adjusting your date range or filters.</p>
            </div>
          ) : (
            <div className="payroll-report-content">
              <table className="payroll-report-table" data-testid="payroll-report-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Period</th>
                    <th className="numeric">Ag Hours</th>
                    <th className="numeric">Ag Earnings</th>
                    <th className="numeric">Non-Ag Hours</th>
                    <th className="numeric">Non-Ag Earnings</th>
                    <th className="numeric">OT Hours</th>
                    <th className="numeric">OT Earnings</th>
                    <th className="numeric">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id} data-testid={`payroll-report-row-${record.employeeId}`}>
                      <td className="employee-name">{record.employee.name}</td>
                      <td className="period">
                        {formatDate(record.periodStart)} - {formatDate(record.periodEnd)}
                      </td>
                      <td className="numeric">{formatHours(record.agriculturalHours)}</td>
                      <td className="numeric">{formatCurrency(record.agriculturalEarnings)}</td>
                      <td className="numeric">{formatHours(record.nonAgriculturalHours)}</td>
                      <td className="numeric">{formatCurrency(record.nonAgriculturalEarnings)}</td>
                      <td className="numeric">{formatHours(record.overtimeHours)}</td>
                      <td className="numeric">{formatCurrency(record.overtimeEarnings)}</td>
                      <td className="numeric total">{formatCurrency(record.totalEarnings)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Initial State */}
      {!loading && !hasSearched && (
        <div className="payroll-report-empty">
          <div className="empty-icon">&#128269;</div>
          <h2>Select a date range</h2>
          <p>Choose a start and end date, then click "Apply Filters" to view payroll records.</p>
        </div>
      )}
    </div>
  );
}
