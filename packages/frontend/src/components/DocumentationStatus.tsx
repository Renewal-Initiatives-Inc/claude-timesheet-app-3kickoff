import type { DocumentationStatus as DocStatus } from '@renewal/types';
import './DocumentationStatus.css';

interface DocumentationStatusProps {
  status: DocStatus;
  compact?: boolean;
}

/**
 * Badge showing documentation completion status
 */
export function DocumentationStatus({ status, compact = false }: DocumentationStatusProps) {
  if (compact) {
    // Compact version - just a colored badge
    return (
      <span
        className={`doc-status-badge ${status.isComplete ? 'doc-status-complete' : 'doc-status-incomplete'}`}
      >
        {status.isComplete ? 'Complete' : `${status.missingDocuments.length} Missing`}
      </span>
    );
  }

  // Full version - detailed status
  return (
    <div className="doc-status">
      <div className="doc-status-header">
        <span
          className={`doc-status-badge ${status.isComplete ? 'doc-status-complete' : 'doc-status-incomplete'}`}
        >
          {status.isComplete ? 'Documentation Complete' : 'Documentation Incomplete'}
        </span>
      </div>

      {status.missingDocuments.length > 0 && (
        <div className="doc-status-section">
          <h4>Missing Documents</h4>
          <ul className="doc-status-list">
            {status.missingDocuments.map((type) => (
              <li key={type} className="doc-status-item doc-status-missing">
                {formatDocumentType(type)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {status.expiringDocuments.length > 0 && (
        <div className="doc-status-section">
          <h4>Expiring Soon</h4>
          <ul className="doc-status-list">
            {status.expiringDocuments.map((doc) => (
              <li key={doc.type} className="doc-status-item doc-status-expiring">
                {formatDocumentType(doc.type)} - {doc.daysUntilExpiry} days
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="doc-status-checklist">
        <div
          className={`doc-status-check ${status.hasValidConsent ? 'doc-status-check-valid' : 'doc-status-check-invalid'}`}
        >
          {status.hasValidConsent ? '✓' : '✗'} Parental Consent
        </div>
        {status.hasValidWorkPermit !== null && (
          <div
            className={`doc-status-check ${status.hasValidWorkPermit ? 'doc-status-check-valid' : 'doc-status-check-invalid'}`}
          >
            {status.hasValidWorkPermit ? '✓' : '✗'} Work Permit
          </div>
        )}
        <div
          className={`doc-status-check ${status.safetyTrainingComplete ? 'doc-status-check-valid' : 'doc-status-check-invalid'}`}
        >
          {status.safetyTrainingComplete ? '✓' : '✗'} Safety Training
        </div>
      </div>
    </div>
  );
}

/**
 * Simple badge showing just complete/incomplete count
 */
interface DocumentationBadgeProps {
  isComplete: boolean;
  missingCount: number;
  expiringCount: number;
}

export function DocumentationBadge({
  isComplete,
  missingCount,
  expiringCount,
}: DocumentationBadgeProps) {
  if (isComplete && expiringCount === 0) {
    return <span className="doc-status-badge doc-status-complete">Complete</span>;
  }

  if (isComplete && expiringCount > 0) {
    return <span className="doc-status-badge doc-status-warning">{expiringCount} Expiring</span>;
  }

  return <span className="doc-status-badge doc-status-incomplete">{missingCount} Missing</span>;
}

function formatDocumentType(type: string): string {
  switch (type) {
    case 'parental_consent':
      return 'Parental Consent Form';
    case 'work_permit':
      return 'Work Permit';
    case 'safety_training':
      return 'Safety Training';
    default:
      return type;
  }
}
