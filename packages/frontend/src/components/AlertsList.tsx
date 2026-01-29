import { Link } from 'react-router-dom';
import type { DashboardAlert, AlertType } from '@renewal/types';
import './AlertsList.css';

interface AlertsListProps {
  alerts: DashboardAlert[];
  loading?: boolean;
}

/**
 * Full list view of alerts with filtering
 */
export function AlertsList({ alerts, loading = false }: AlertsListProps) {
  if (loading) {
    return (
      <div className="alerts-list-container" data-testid="alerts-list-loading">
        <div className="alerts-list-loading">Loading alerts...</div>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="alerts-list-container" data-testid="alerts-list-empty">
        <div className="alerts-list-empty">
          <p>No alerts at this time.</p>
          <p>All employees have complete and valid documentation.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="alerts-list-container" data-testid="alerts-list">
      <table className="alerts-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Employee</th>
            <th>Message</th>
            <th>Due Date</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {alerts.map((alert, index) => (
            <tr
              key={`${alert.employeeId}-${alert.type}-${index}`}
              className={`alert-row alert-row-${alert.type}`}
              data-testid={`alert-row-${alert.employeeId}`}
            >
              <td>
                <span className={`alert-type-badge alert-type-${alert.type}`}>
                  {getAlertTypeLabel(alert.type)}
                </span>
              </td>
              <td>
                <Link to={`/employees/${alert.employeeId}`} className="alert-employee-link">
                  {alert.employeeName}
                </Link>
              </td>
              <td className="alert-message-cell">{alert.message}</td>
              <td className="alert-date-cell">{alert.dueDate ? formatDate(alert.dueDate) : '-'}</td>
              <td>
                <Link
                  to={`/employees/${alert.employeeId}`}
                  className="alert-action-link"
                  data-testid={`alert-action-${alert.employeeId}`}
                >
                  View Employee
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function getAlertTypeLabel(type: AlertType): string {
  switch (type) {
    case 'missing_document':
      return 'Missing Docs';
    case 'expiring_document':
      return 'Expiring';
    case 'age_transition':
      return 'Age Change';
    default:
      return 'Alert';
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
