import { useParams, useNavigate, Link } from 'react-router-dom';
import { useReviewDetail } from '../hooks/useReviewQueue.js';
import { TimesheetGrid } from '../components/TimesheetGrid.js';
import { ComplianceSummary } from '../components/ComplianceSummary.js';
import { ReviewActions } from '../components/ReviewActions.js';
import './ReviewDetail.css';

/**
 * Calculate age from date of birth.
 */
function calculateAge(dateOfBirth: string, asOfDate?: string): number {
  const dob = new Date(dateOfBirth);
  const asOf = asOfDate ? new Date(asOfDate) : new Date();
  let age = asOf.getFullYear() - dob.getFullYear();
  const monthDiff = asOf.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && asOf.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

/**
 * Format a date string as a readable week range.
 */
function formatWeekRange(weekStartDate: string): string {
  const start = new Date(weekStartDate + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  };
  return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
}

/**
 * Get status badge class.
 */
function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'submitted':
      return 'status-badge--submitted';
    case 'approved':
      return 'status-badge--approved';
    case 'rejected':
      return 'status-badge--rejected';
    default:
      return 'status-badge--open';
  }
}

export function ReviewDetail() {
  const { timesheetId } = useParams<{ timesheetId: string }>();
  const navigate = useNavigate();
  const { reviewData, loading, error, approving, rejecting, approve, reject, refresh } =
    useReviewDetail(timesheetId);

  const handleApprove = async (notes?: string): Promise<boolean> => {
    const success = await approve(notes);
    if (success) {
      navigate('/review');
    }
    return success;
  };

  const handleReject = async (notes: string): Promise<boolean> => {
    const success = await reject(notes);
    if (success) {
      navigate('/review');
    }
    return success;
  };

  if (loading) {
    return (
      <div className="review-detail">
        <div className="review-detail-loading">Loading timesheet for review...</div>
      </div>
    );
  }

  if (error || !reviewData) {
    return (
      <div className="review-detail">
        <div className="review-detail-error" data-testid="error-review-detail">
          <p>{error || 'Timesheet not found'}</p>
          <button onClick={refresh} data-testid="review-detail-retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { timesheet, employee, complianceLogs } = reviewData;
  const employeeAge = calculateAge(employee.dateOfBirth, timesheet.weekStartDate);
  const isReviewable = timesheet.status === 'submitted';

  return (
    <div className="review-detail" data-testid="review-detail-page">
      <header className="review-detail-header">
        <Link to="/review" className="review-detail-back">
          &larr; Back to Queue
        </Link>
        <h1>Timesheet Review</h1>
      </header>

      <section className="review-employee-info" data-testid="review-employee-info">
        <div className="employee-info-card">
          <div className="employee-info-main">
            <h2>{employee.name}</h2>
            <p className="employee-email">{employee.email}</p>
          </div>
          <div className="employee-info-details">
            <div className="employee-info-item">
              <span className="info-label">Age</span>
              <span className="info-value">{employeeAge}</span>
            </div>
            <div className="employee-info-item">
              <span className="info-label">Week</span>
              <span className="info-value">{formatWeekRange(timesheet.weekStartDate)}</span>
            </div>
            <div className="employee-info-item">
              <span className="info-label">Status</span>
              <span className={`status-badge ${getStatusBadgeClass(timesheet.status)}`}>
                {timesheet.status}
              </span>
            </div>
          </div>
        </div>
      </section>

      {complianceLogs.length > 0 && (
        <section className="review-compliance">
          <ComplianceSummary logs={complianceLogs} />
        </section>
      )}

      <section className="review-timesheet">
        <h3>Timesheet Entries</h3>
        <div className="review-timesheet-readonly">
          <TimesheetGrid
            timesheet={timesheet}
            totals={timesheet.totals}
            employeeAge={employeeAge}
            onAddEntry={() => {}}
            onEditEntry={() => {}}
            onDeleteEntry={() => {}}
            disabled={true}
          />
        </div>
      </section>

      {isReviewable && (
        <section className="review-actions-section">
          <ReviewActions
            onApprove={handleApprove}
            onReject={handleReject}
            approving={approving}
            rejecting={rejecting}
            error={error}
          />
        </section>
      )}

      {!isReviewable && (
        <section className="review-info-section">
          <div className="review-info-message">
            This timesheet has status "{timesheet.status}" and cannot be reviewed.
            {timesheet.supervisorNotes && (
              <div className="review-existing-notes">
                <strong>Previous notes:</strong> {timesheet.supervisorNotes}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
