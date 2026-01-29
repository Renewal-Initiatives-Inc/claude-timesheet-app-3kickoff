import { Link } from 'react-router-dom';
import './ReportsDashboard.css';

export function MyReportsDashboard() {
  return (
    <div className="reports-dashboard">
      <header className="reports-dashboard-header">
        <h1>My Reports</h1>
        <p className="reports-dashboard-subtitle">View your timesheet history and status</p>
      </header>

      {/* Report Cards */}
      <div className="reports-dashboard-cards">
        <Link
          to="/my-reports/timesheet-history"
          className="report-card"
          data-testid="my-reports-dashboard-timesheet-card"
        >
          <div className="report-card-icon">&#128197;</div>
          <div className="report-card-content">
            <h2>My Timesheet History</h2>
            <p>
              View your submitted timesheets, approval status, and review feedback. Track your
              timesheet submissions over time.
            </p>
          </div>
          <div className="report-card-arrow">&#8594;</div>
        </Link>
      </div>

      {/* Information Section */}
      <div className="reports-dashboard-info">
        <h3>What You Can See</h3>
        <ul>
          <li>
            <strong>Submission Status:</strong> See whether your timesheets are open, submitted, or
            approved
          </li>
          <li>
            <strong>Review Feedback:</strong> View any notes from your supervisor on reviewed
            timesheets
          </li>
          <li>
            <strong>Hours &amp; Earnings:</strong> Track your total hours worked and earnings per
            pay period
          </li>
          <li>
            <strong>Compliance Status:</strong> See if any compliance checks were flagged on your
            timesheets
          </li>
        </ul>
      </div>
    </div>
  );
}
