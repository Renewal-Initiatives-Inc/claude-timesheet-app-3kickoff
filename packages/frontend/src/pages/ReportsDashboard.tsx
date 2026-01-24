import { useState, useEffect } from 'react';
import { getDashboardStats, ApiRequestError } from '../api/client.js';
import './ReportsDashboard.css';

interface DashboardData {
  pendingReviews: number;
  activeEmployees: number;
}

export function ReportsDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const statsResponse = await getDashboardStats();

        setData({
          pendingReviews: statsResponse.stats.pendingReviewCount,
          activeEmployees: statsResponse.stats.totalEmployees,
        });
      } catch (err) {
        if (err instanceof ApiRequestError) {
          setError(err.message);
        } else {
          setError('Failed to load dashboard data');
        }
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  return (
    <div className="reports-dashboard">
      <header className="reports-dashboard-header">
        <h1>Reports</h1>
        <p className="reports-dashboard-subtitle">
          Access compliance, payroll, and timesheet reports
        </p>
      </header>

      {/* Quick Stats */}
      {loading ? (
        <div className="reports-dashboard-stats loading">
          Loading stats...
        </div>
      ) : error ? (
        <div className="reports-dashboard-stats error">
          {error}
        </div>
      ) : data && (
        <div className="reports-dashboard-stats">
          <div className="stat-item">
            <span className="stat-value">{data.pendingReviews}</span>
            <span className="stat-label">Pending Reviews</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{data.activeEmployees}</span>
            <span className="stat-label">Active Employees</span>
          </div>
        </div>
      )}

      {/* Report Cards */}
      <div className="reports-dashboard-cards">
        <a
          href="/reports/payroll"
          className="report-card"
          data-testid="reports-dashboard-payroll-card"
        >
          <div className="report-card-icon">&#128181;</div>
          <div className="report-card-content">
            <h2>Payroll Report</h2>
            <p>
              View earnings, hours worked, and export payroll data for approved
              timesheets.
            </p>
          </div>
          <div className="report-card-arrow">&#8594;</div>
        </a>

        <a
          href="/reports/compliance-audit"
          className="report-card"
          data-testid="reports-dashboard-compliance-card"
        >
          <div className="report-card-icon">&#128203;</div>
          <div className="report-card-content">
            <h2>Compliance Audit</h2>
            <p>
              Review compliance check history, rule violations, and audit
              records with filtering by employee, age band, and date range.
            </p>
          </div>
          <div className="report-card-arrow">&#8594;</div>
        </a>

        <a
          href="/reports/timesheet-history"
          className="report-card"
          data-testid="reports-dashboard-timesheet-card"
        >
          <div className="report-card-icon">&#128197;</div>
          <div className="report-card-content">
            <h2>Timesheet History</h2>
            <p>
              View historical timesheet status, review decisions, and rejection
              notes across all employees.
            </p>
          </div>
          <div className="report-card-arrow">&#8594;</div>
        </a>
      </div>

      {/* Information Section */}
      <div className="reports-dashboard-info">
        <h3>Report Features</h3>
        <ul>
          <li>
            <strong>Date Range Filtering:</strong> All reports support custom
            date ranges for precise data retrieval
          </li>
          <li>
            <strong>Employee Filtering:</strong> Filter by individual employee
            or view all employees
          </li>
          <li>
            <strong>Age Band Filtering:</strong> Filter by age group (12-13,
            14-15, 16-17, 18+) for compliance tracking
          </li>
          <li>
            <strong>CSV Export:</strong> Download data for external analysis and
            record keeping
          </li>
          <li>
            <strong>Read-Only:</strong> Reports display data only - no
            modifications can be made
          </li>
        </ul>
      </div>
    </div>
  );
}
