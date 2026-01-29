import { Link } from 'react-router-dom';
import type { DashboardAlert } from '@renewal/types';
import './AlertsBanner.css';

interface AlertsBannerProps {
  alerts: DashboardAlert[];
  maxItems?: number;
  loading?: boolean;
  onRefresh?: () => void;
}

/**
 * Banner displaying pending alerts/actions for supervisors
 */
export function AlertsBanner({
  alerts,
  maxItems = 5,
  loading = false,
  onRefresh,
}: AlertsBannerProps) {
  if (loading) {
    return (
      <div className="alerts-banner alerts-banner-loading" data-testid="alerts-banner-loading">
        <div className="alerts-header">
          <h3>Loading alerts...</h3>
        </div>
      </div>
    );
  }

  if (alerts.length === 0) {
    return null;
  }

  const displayAlerts = alerts.slice(0, maxItems);
  const remainingCount = alerts.length - maxItems;

  return (
    <div className="alerts-banner" data-testid="alerts-banner">
      <div className="alerts-header">
        <h3>Action Required ({alerts.length})</h3>
        {onRefresh && (
          <button
            className="alerts-refresh-button"
            onClick={onRefresh}
            data-testid="alerts-refresh-button"
            aria-label="Refresh alerts"
          >
            Refresh
          </button>
        )}
      </div>
      <ul className="alerts-list">
        {displayAlerts.map((alert, index) => (
          <li key={`${alert.employeeId}-${alert.type}-${index}`} className="alert-item">
            <span className={`alert-icon alert-icon-${alert.type}`}>
              {getAlertIcon(alert.type)}
            </span>
            <Link
              to={`/employees/${alert.employeeId}`}
              className="alert-link"
              data-testid={`alert-link-${alert.employeeId}`}
            >
              <span className="alert-employee">{alert.employeeName}</span>
              <span className="alert-message">{alert.message}</span>
            </Link>
            {alert.dueDate && <span className="alert-date">Due: {formatDate(alert.dueDate)}</span>}
          </li>
        ))}
      </ul>
      {remainingCount > 0 && (
        <div className="alerts-more">
          <Link to="/alerts" className="alerts-view-all" data-testid="alerts-view-all-link">
            View all {alerts.length} alerts
          </Link>
        </div>
      )}
    </div>
  );
}

function getAlertIcon(type: string): string {
  switch (type) {
    case 'missing_document':
      return '!';
    case 'expiring_document':
      return '⏰';
    case 'age_transition':
      return '🎂';
    default:
      return '•';
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}
