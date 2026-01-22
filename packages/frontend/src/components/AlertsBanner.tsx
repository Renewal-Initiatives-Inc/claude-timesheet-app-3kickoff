import { Link } from 'react-router-dom';
import type { DashboardAlert } from '@renewal/types';
import './AlertsBanner.css';

interface AlertsBannerProps {
  alerts: DashboardAlert[];
  maxItems?: number;
}

/**
 * Banner displaying pending alerts/actions for supervisors
 */
export function AlertsBanner({ alerts, maxItems = 5 }: AlertsBannerProps) {
  if (alerts.length === 0) {
    return null;
  }

  const displayAlerts = alerts.slice(0, maxItems);
  const remainingCount = alerts.length - maxItems;

  return (
    <div className="alerts-banner">
      <div className="alerts-header">
        <h3>Action Required ({alerts.length})</h3>
      </div>
      <ul className="alerts-list">
        {displayAlerts.map((alert, index) => (
          <li key={`${alert.employeeId}-${alert.type}-${index}`} className="alert-item">
            <span className={`alert-icon alert-icon-${alert.type}`}>
              {getAlertIcon(alert.type)}
            </span>
            <Link to={`/employees/${alert.employeeId}`} className="alert-link">
              <span className="alert-employee">{alert.employeeName}</span>
              <span className="alert-message">{alert.message}</span>
            </Link>
            {alert.dueDate && (
              <span className="alert-date">Due: {formatDate(alert.dueDate)}</span>
            )}
          </li>
        ))}
      </ul>
      {remainingCount > 0 && (
        <div className="alerts-more">
          +{remainingCount} more alert{remainingCount > 1 ? 's' : ''}
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
