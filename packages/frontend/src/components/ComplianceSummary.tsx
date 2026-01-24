import { useState } from 'react';
import type { ComplianceCheckLog, ComplianceResult } from '@renewal/types';
import './ComplianceSummary.css';

interface ComplianceSummaryProps {
  logs: ComplianceCheckLog[];
}

function getResultLabel(result: ComplianceResult): string {
  switch (result) {
    case 'pass':
      return 'Passed';
    case 'fail':
      return 'Failed';
    case 'not_applicable':
      return 'N/A';
    default:
      return result;
  }
}

function getResultClass(result: ComplianceResult): string {
  switch (result) {
    case 'pass':
      return 'compliance-result--pass';
    case 'fail':
      return 'compliance-result--fail';
    case 'not_applicable':
      return 'compliance-result--na';
    default:
      return '';
  }
}

export function ComplianceSummary({ logs }: ComplianceSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate summary statistics
  const total = logs.length;
  const passed = logs.filter((log) => log.result === 'pass').length;
  const failed = logs.filter((log) => log.result === 'fail').length;
  const notApplicable = logs.filter((log) => log.result === 'not_applicable').length;

  return (
    <div className="compliance-summary" data-testid="compliance-summary">
      <div className="compliance-summary-header">
        <h3>Compliance Check Results</h3>
        <button
          className="compliance-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
          data-testid="compliance-toggle-button"
        >
          {isExpanded ? 'Hide Details' : 'Show Details'}
        </button>
      </div>

      <div className="compliance-stats">
        <div className="compliance-stat compliance-stat--total">
          <span className="compliance-stat-value">{total}</span>
          <span className="compliance-stat-label">Total Rules</span>
        </div>
        <div className="compliance-stat compliance-stat--passed">
          <span className="compliance-stat-value">{passed}</span>
          <span className="compliance-stat-label">Passed</span>
        </div>
        <div className="compliance-stat compliance-stat--failed">
          <span className="compliance-stat-value">{failed}</span>
          <span className="compliance-stat-label">Failed</span>
        </div>
        <div className="compliance-stat compliance-stat--na">
          <span className="compliance-stat-value">{notApplicable}</span>
          <span className="compliance-stat-label">N/A</span>
        </div>
      </div>

      {failed > 0 && (
        <div className="compliance-warning">
          This timesheet has {failed} compliance violation{failed !== 1 ? 's' : ''}.
          It should not have been submittable with violations.
        </div>
      )}

      {isExpanded && (
        <div className="compliance-details" data-testid="compliance-details">
          <table className="compliance-table">
            <thead>
              <tr>
                <th>Rule ID</th>
                <th>Description</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className={getResultClass(log.result)}>
                  <td className="compliance-rule-id">{log.ruleId}</td>
                  <td className="compliance-rule-description">
                    {log.details.ruleDescription}
                    {log.details.message && (
                      <span className="compliance-message">{log.details.message}</span>
                    )}
                  </td>
                  <td>
                    <span className={`compliance-badge ${getResultClass(log.result)}`}>
                      {getResultLabel(log.result)}
                    </span>
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
