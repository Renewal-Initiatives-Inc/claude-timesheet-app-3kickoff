import type { HourLimits, AgeBand } from '@renewal/types';
import './HourLimitsDisplay.css';

interface HourLimitsDisplayProps {
  totals: {
    weekly: number;
    daily: Record<string, number>;
  };
  limits: HourLimits;
  ageBand: AgeBand;
}

/**
 * Calculate percentage for progress bar
 */
function calculatePercentage(current: number, limit: number): number {
  return Math.min((current / limit) * 100, 100);
}

/**
 * Get status class based on percentage
 */
function getStatusClass(current: number, limit: number): string {
  const percentage = (current / limit) * 100;
  if (percentage >= 100) return 'at-limit';
  if (percentage >= 80) return 'approaching-limit';
  return 'ok';
}

export function HourLimitsDisplay({ totals, limits, ageBand }: HourLimitsDisplayProps) {
  const weeklyPercentage = calculatePercentage(totals.weekly, limits.weeklyLimit);
  const weeklyStatus = getStatusClass(totals.weekly, limits.weeklyLimit);

  return (
    <div className="hour-limits-display">
      <div className="limits-header">
        <h4>Hour Limits</h4>
        <span className="age-band-badge">{ageBand}</span>
      </div>

      <div className="limit-item weekly">
        <div className="limit-label">
          <span className="label-text">Weekly</span>
          <span className="limit-values">
            {totals.weekly.toFixed(1)} / {limits.weeklyLimit} hrs
          </span>
        </div>
        <div className="progress-bar">
          <div
            className={`progress-fill ${weeklyStatus}`}
            style={{ width: `${weeklyPercentage}%` }}
          />
        </div>
      </div>

      <div className="limits-rules">
        <div className="rule-item">
          <span className="rule-label">Daily Max:</span>
          <span className="rule-value">{limits.dailyLimit} hrs</span>
        </div>
        {limits.dailyLimitSchoolDay !== undefined && (
          <div className="rule-item">
            <span className="rule-label">School Day Max:</span>
            <span className="rule-value">{limits.dailyLimitSchoolDay} hrs</span>
          </div>
        )}
        {limits.weeklyLimitSchoolWeek !== undefined && (
          <div className="rule-item">
            <span className="rule-label">School Week Max:</span>
            <span className="rule-value">{limits.weeklyLimitSchoolWeek} hrs</span>
          </div>
        )}
        {limits.daysWorkedLimit !== undefined && (
          <div className="rule-item">
            <span className="rule-label">Max Days/Week:</span>
            <span className="rule-value">{limits.daysWorkedLimit} days</span>
          </div>
        )}
      </div>

      {ageBand !== '18+' && (
        <div className="limits-note">
          These limits are based on your age and help ensure compliance with youth labor laws.
        </div>
      )}
    </div>
  );
}
