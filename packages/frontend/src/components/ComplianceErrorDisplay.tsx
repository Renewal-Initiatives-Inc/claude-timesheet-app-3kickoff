import './ComplianceErrorDisplay.css';

/**
 * Compliance violation from the API.
 */
export interface ComplianceViolation {
  ruleId: string;
  ruleName: string;
  message: string;
  remediation: string;
  affectedDates?: string[];
  affectedEntries?: string[];
}

interface ComplianceErrorDisplayProps {
  violations: ComplianceViolation[];
  onClose?: () => void;
  onEntryClick?: (entryId: string) => void;
}

/**
 * Display compliance check failures with remediation guidance.
 */
export function ComplianceErrorDisplay({
  violations,
  onClose,
  onEntryClick,
}: ComplianceErrorDisplayProps) {
  if (violations.length === 0) {
    return null;
  }

  return (
    <div
      className="compliance-errors"
      role="alert"
      aria-live="polite"
      data-testid="compliance-errors"
    >
      <div className="compliance-errors__header">
        <div className="compliance-errors__icon">!</div>
        <h3 className="compliance-errors__title">Compliance Check Failed</h3>
        {onClose && (
          <button
            type="button"
            className="compliance-errors__close"
            onClick={onClose}
            aria-label="Dismiss errors"
            data-testid="compliance-errors-close-button"
          >
            ×
          </button>
        )}
      </div>

      <p className="compliance-errors__intro">
        Please fix the following {violations.length} issue{violations.length !== 1 ? 's' : ''}{' '}
        before resubmitting:
      </p>

      <ul className="compliance-errors__list">
        {violations.map((violation, index) => (
          <li
            key={`${violation.ruleId}-${index}`}
            className="compliance-error"
            data-testid={`compliance-error-${violation.ruleId}`}
          >
            <div className="compliance-error__header">
              <span className="compliance-error__rule-id">{violation.ruleId}</span>
              <span className="compliance-error__rule-name">{violation.ruleName}</span>
            </div>

            <p className="compliance-error__message">{violation.message}</p>

            <p className="compliance-error__remediation">
              <strong>How to fix:</strong> {violation.remediation}
            </p>

            {violation.affectedDates && violation.affectedDates.length > 0 && (
              <div className="compliance-error__affected">
                <span className="compliance-error__affected-label">Affected dates:</span>
                {violation.affectedDates.map((date) => (
                  <span key={date} className="compliance-error__date">
                    {formatDate(date)}
                  </span>
                ))}
              </div>
            )}

            {violation.affectedEntries && violation.affectedEntries.length > 0 && onEntryClick && (
              <div className="compliance-error__entries">
                <button
                  type="button"
                  className="compliance-error__view-entry"
                  onClick={() => onEntryClick(violation.affectedEntries![0]!)}
                  data-testid={`compliance-error-view-entry-${violation.ruleId}`}
                >
                  View affected entry
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Format a date for display.
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}
