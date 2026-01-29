import { Link } from 'react-router-dom';
import { useReviewQueue } from '../hooks/useReviewQueue.js';
import './ReviewQueue.css';

/**
 * Format a date string as a readable week range.
 */
function formatWeekRange(weekStartDate: string): string {
  const start = new Date(weekStartDate + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
}

/**
 * Format a timestamp as a relative time.
 */
function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ReviewQueue() {
  const { items, total, loading, error, refresh } = useReviewQueue();

  if (loading) {
    return (
      <div className="review-queue">
        <div className="review-queue-loading" data-testid="review-queue-loading">
          Loading review queue...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="review-queue">
        <div className="review-queue-error" data-testid="error-review-queue">
          <p>Error loading review queue: {error}</p>
          <button onClick={refresh} data-testid="review-queue-retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="review-queue">
      <header className="review-queue-header">
        <div>
          <h1>Review Queue</h1>
          <p className="review-queue-subtitle">
            {total === 0
              ? 'No timesheets pending review'
              : `${total} timesheet${total !== 1 ? 's' : ''} awaiting review`}
          </p>
        </div>
      </header>

      {items.length === 0 ? (
        <div className="review-queue-empty" data-testid="review-queue-empty-state">
          <div className="empty-icon">&#10003;</div>
          <h2>All caught up!</h2>
          <p>There are no timesheets waiting for review.</p>
        </div>
      ) : (
        <div className="review-queue-content">
          <table className="review-queue-table" data-testid="review-queue-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Week</th>
                <th>Hours</th>
                <th>Entries</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} data-testid={`review-queue-row-${item.id}`}>
                  <td className="review-queue-employee">
                    <span className="employee-name">{item.employeeName}</span>
                  </td>
                  <td>{formatWeekRange(item.weekStartDate)}</td>
                  <td className="review-queue-hours">{item.totalHours.toFixed(1)}</td>
                  <td>{item.entryCount}</td>
                  <td className="review-queue-submitted">{formatRelativeTime(item.submittedAt)}</td>
                  <td>
                    <Link
                      to={`/review/${item.id}`}
                      className="review-queue-view-button"
                      data-testid="review-queue-view-button"
                    >
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
