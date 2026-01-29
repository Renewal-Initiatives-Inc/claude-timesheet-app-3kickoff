import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDashboard } from '../hooks/useEmployees.js';
import { useAuth } from '../hooks/useAuth.js';
import { AlertsBanner } from '../components/AlertsBanner.js';
import { DocumentationBadge } from '../components/DocumentationStatus.js';
import './Dashboard.css';

// Auto-refresh interval in milliseconds (5 minutes)
const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000;

export function Dashboard() {
  const { user } = useAuth();
  const { employees, alerts, stats, loading, error, refetch } = useDashboard();

  // Auto-refresh dashboard every 5 minutes
  useEffect(() => {
    const intervalId = setInterval(() => {
      refetch();
    }, AUTO_REFRESH_INTERVAL);

    return () => clearInterval(intervalId);
  }, [refetch]);

  if (loading) {
    return (
      <div className="dashboard">
        <div className="dashboard-loading">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard">
        <div className="dashboard-error">
          <p>Error loading dashboard: {error}</p>
          <button onClick={refetch} data-testid="dashboard-retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <p>Welcome back, {user?.name}</p>
        </div>
        <Link
          to="/employees/add"
          className="dashboard-add-button"
          data-testid="dashboard-add-employee-button"
        >
          + Add Employee
        </Link>
      </header>

      <AlertsBanner alerts={alerts} maxItems={5} onRefresh={refetch} />

      {stats && (
        <div className="dashboard-stats">
          <div className="stat-card">
            <span className="stat-value">{stats.totalEmployees}</span>
            <span className="stat-label">Total Employees</span>
          </div>
          <div className="stat-card stat-success">
            <span className="stat-value">{stats.completeDocumentation}</span>
            <span className="stat-label">Complete Documentation</span>
          </div>
          <div className="stat-card stat-danger">
            <span className="stat-value">{stats.missingDocumentation}</span>
            <span className="stat-label">Missing Documentation</span>
          </div>
          <div className="stat-card stat-warning">
            <span className="stat-value">{stats.expiringDocuments}</span>
            <span className="stat-label">Expiring Soon</span>
          </div>
          <Link
            to="/review"
            className={`stat-card stat-card-link ${stats.pendingReviewCount > 0 ? 'stat-pending' : ''}`}
            data-testid="dashboard-pending-review-link"
          >
            <span className="stat-value">{stats.pendingReviewCount}</span>
            <span className="stat-label">Pending Review</span>
          </Link>
        </div>
      )}

      <section className="dashboard-section">
        <div className="section-header">
          <h2>Employees</h2>
          <Link
            to="/employees"
            className="section-link"
            data-testid="dashboard-view-all-employees-link"
          >
            View All
          </Link>
        </div>

        {employees.length === 0 ? (
          <div className="dashboard-empty">
            <p>No employees found.</p>
            <Link to="/employees/add" data-testid="dashboard-add-first-employee-link">
              Add your first employee
            </Link>
          </div>
        ) : (
          <div className="dashboard-employees">
            <table className="employees-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Age</th>
                  <th>Age Band</th>
                  <th>Documentation</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {employees.slice(0, 10).map((employee) => (
                  <tr key={employee.id}>
                    <td>
                      <Link to={`/employees/${employee.id}`} className="employee-name">
                        {employee.name}
                      </Link>
                      <span className="employee-email">{employee.email}</span>
                    </td>
                    <td>{employee.age}</td>
                    <td>
                      <span
                        className={`age-band age-band-${employee.ageBand.replace('+', 'plus')}`}
                      >
                        {employee.ageBand}
                      </span>
                    </td>
                    <td>
                      <DocumentationBadge
                        isComplete={employee.documentation.isComplete}
                        missingCount={employee.documentation.missingCount}
                        expiringCount={employee.documentation.expiringCount}
                      />
                    </td>
                    <td>
                      <Link to={`/employees/${employee.id}`} className="table-action">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {stats && (
        <section className="dashboard-section">
          <h2>Age Distribution</h2>
          <div className="age-distribution">
            <div className="age-bar-container">
              <div className="age-bar">
                <div
                  className="age-bar-fill age-band-12-13"
                  style={{ width: `${(stats.byAgeBand['12-13'] / stats.totalEmployees) * 100}%` }}
                />
                <div
                  className="age-bar-fill age-band-14-15"
                  style={{ width: `${(stats.byAgeBand['14-15'] / stats.totalEmployees) * 100}%` }}
                />
                <div
                  className="age-bar-fill age-band-16-17"
                  style={{ width: `${(stats.byAgeBand['16-17'] / stats.totalEmployees) * 100}%` }}
                />
                <div
                  className="age-bar-fill age-band-18plus"
                  style={{ width: `${(stats.byAgeBand['18+'] / stats.totalEmployees) * 100}%` }}
                />
              </div>
            </div>
            <div className="age-legend">
              <span className="age-legend-item">
                <span className="age-legend-color age-band-12-13"></span>
                12-13: {stats.byAgeBand['12-13']}
              </span>
              <span className="age-legend-item">
                <span className="age-legend-color age-band-14-15"></span>
                14-15: {stats.byAgeBand['14-15']}
              </span>
              <span className="age-legend-item">
                <span className="age-legend-color age-band-16-17"></span>
                16-17: {stats.byAgeBand['16-17']}
              </span>
              <span className="age-legend-item">
                <span className="age-legend-color age-band-18plus"></span>
                18+: {stats.byAgeBand['18+']}
              </span>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
