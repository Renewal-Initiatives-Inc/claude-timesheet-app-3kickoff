import { useState, useEffect, useCallback } from 'react';
import type {
  TaskCodeWithCurrentRate,
  EntryPreviewRequest,
  EntryCompliancePreview,
} from '@renewal/types';
import './TaskAssignmentPopover.css';

interface TaskAssignmentPopoverProps {
  taskCodes: TaskCodeWithCurrentRate[];
  startTime: string;
  endTime: string;
  dayCount: number;
  employeeAge: number;
  workDates: string[]; // Actual dates for the selected days
  schoolDayStatus: boolean[]; // Is each day a school day
  onPreview?: (entry: EntryPreviewRequest) => Promise<EntryCompliancePreview | null>;
  onAssign: (
    taskCodeId: string,
    supervisorName?: string,
    mealBreakConfirmed?: boolean,
    notes?: string
  ) => Promise<void>;
  onClose: () => void;
}

/**
 * Format time like "9:00 AM"
 */
function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const hour12 = (hours ?? 0) > 12 ? (hours ?? 0) - 12 : (hours ?? 0) === 0 ? 12 : (hours ?? 0);
  const ampm = (hours ?? 0) >= 12 ? 'PM' : 'AM';
  return `${hour12}:${String(minutes ?? 0).padStart(2, '0')} ${ampm}`;
}

/**
 * Calculate hours from start and end time
 */
function calculateHours(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  const startMinutes = (startH ?? 0) * 60 + (startM ?? 0);
  const endMinutes = (endH ?? 0) * 60 + (endM ?? 0);
  return (endMinutes - startMinutes) / 60;
}

export function TaskAssignmentPopover({
  taskCodes,
  startTime,
  endTime,
  dayCount,
  employeeAge,
  workDates,
  schoolDayStatus,
  onPreview,
  onAssign,
  onClose,
}: TaskAssignmentPopoverProps) {
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [supervisorName, setSupervisorName] = useState('');
  const [mealBreakConfirmed, setMealBreakConfirmed] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compliance preview state
  const [preview, setPreview] = useState<EntryCompliancePreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const selectedTask = taskCodes.find((tc) => tc.id === selectedTaskId);
  const hours = calculateHours(startTime, endTime);
  const isMinor = employeeAge < 18;

  // Fetch compliance preview when task changes
  const fetchPreview = useCallback(async () => {
    if (!onPreview || !workDates.length) return;

    // Use first selected day for preview (most conservative check)
    const firstDate = workDates[0];
    const firstSchoolDay = schoolDayStatus[0] ?? false;

    setLoadingPreview(true);
    try {
      const result = await onPreview({
        workDate: firstDate!,
        startTime,
        endTime,
        taskCodeId: selectedTaskId || taskCodes[0]?.id || '',
        isSchoolDay: firstSchoolDay,
      });
      setPreview(result);
    } catch {
      // Preview failed, continue without it
      setPreview(null);
    } finally {
      setLoadingPreview(false);
    }
  }, [onPreview, workDates, schoolDayStatus, startTime, endTime, selectedTaskId, taskCodes]);

  // Fetch preview on mount and when task changes
  useEffect(() => {
    if (selectedTaskId) {
      fetchPreview();
    }
  }, [selectedTaskId, fetchPreview]);

  // Initial preview without task (for limits info)
  useEffect(() => {
    if (taskCodes.length > 0 && !selectedTaskId) {
      fetchPreview();
    }
  }, [taskCodes, selectedTaskId, fetchPreview]);

  // Use preview requirements if available, otherwise fall back to task-based checks
  const needsSupervisor = preview?.requirements.supervisorRequired ?? (
    selectedTask &&
    (selectedTask.supervisorRequired === 'always' ||
      (selectedTask.supervisorRequired === 'for_minors' && isMinor))
  );

  const needsMealBreak = preview?.requirements.mealBreakRequired ?? (hours > 6 && isMinor);

  // Check if there are blocking violations
  const hasViolations = Boolean(preview && preview.violations.length > 0);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedTaskId) {
      setError('Please select a task');
      return;
    }

    if (needsSupervisor && !supervisorName.trim()) {
      setError('Supervisor name is required for this task');
      return;
    }

    if (needsMealBreak && !mealBreakConfirmed) {
      setError('Please confirm you took a meal break');
      return;
    }

    setSubmitting(true);
    try {
      await onAssign(
        selectedTaskId,
        needsSupervisor ? supervisorName : undefined,
        needsMealBreak ? mealBreakConfirmed : undefined,
        notes.trim() || undefined
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create entry');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="task-assignment-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="task-assignment-popover"
        onClick={(e) => e.stopPropagation()}
        data-testid="task-assignment-popover"
        role="dialog"
        aria-modal="true"
        aria-labelledby="popover-title"
        aria-describedby="popover-info"
      >
      <div className="popover-header">
        <h4 id="popover-title">Assign Task</h4>
        <button
          className="close-btn"
          onClick={onClose}
          data-testid="popover-close"
          aria-label="Close dialog"
        >
          ×
        </button>
      </div>

      <div className="popover-info" id="popover-info">
        <span className="time-range">
          {formatTime(startTime)} - {formatTime(endTime)}
        </span>
        <span className="hours-badge">{hours.toFixed(1)}h</span>
        {dayCount > 1 && <span className="days-badge">× {dayCount} days</span>}
      </div>

      {/* Compliance preview info */}
      {loadingPreview && (
        <div
          className="compliance-loading"
          data-testid="compliance-loading"
          role="status"
          aria-busy="true"
          aria-label="Checking compliance"
        >
          Checking compliance...
        </div>
      )}

      {preview && !loadingPreview && (
        <div
          className="compliance-preview"
          data-testid="compliance-preview"
          aria-busy={loadingPreview}
        >
          {/* Violations (blocking) */}
          {preview.violations.length > 0 && (
            <div
              className="compliance-violations"
              data-testid="compliance-violations"
              role="alert"
              aria-live="assertive"
            >
              <div className="violation-header">Cannot create entry:</div>
              {preview.violations.map((v, i) => (
                <div key={i} className="violation-item">
                  <span className="violation-icon" aria-hidden="true">⛔</span>
                  <span className="violation-message">{v.message}</span>
                </div>
              ))}
            </div>
          )}

          {/* Warnings (informational) */}
          {preview.warnings.length > 0 && (
            <div
              className="compliance-warnings"
              data-testid="compliance-warnings"
              role="status"
              aria-live="polite"
            >
              {preview.warnings.map((w, i) => (
                <div key={i} className="warning-item">
                  <span className="warning-icon" aria-hidden="true">⚠️</span>
                  <span className="warning-message">{w.message}</span>
                </div>
              ))}
            </div>
          )}

          {/* Remaining hours */}
          {preview.violations.length === 0 && (
            <div className="compliance-limits" data-testid="compliance-limits">
              <div className="limit-item">
                <span className="limit-label">Today:</span>
                <span
                  className={`limit-value ${
                    preview.limits.daily.remaining < hours
                      ? 'over-limit'
                      : preview.limits.daily.remaining <= hours * 1.2
                        ? 'near-limit'
                        : ''
                  }`}
                >
                  {preview.limits.daily.remaining.toFixed(1)}h remaining
                </span>
                <span className="limit-max">/ {preview.limits.daily.limit}h daily</span>
              </div>
              <div className="limit-item">
                <span className="limit-label">Week:</span>
                <span
                  className={`limit-value ${
                    preview.limits.weekly.remaining < hours * dayCount
                      ? 'over-limit'
                      : preview.limits.weekly.remaining <= hours * dayCount * 1.2
                        ? 'near-limit'
                        : ''
                  }`}
                >
                  {preview.limits.weekly.remaining.toFixed(1)}h remaining
                </span>
                <span className="limit-max">/ {preview.limits.weekly.limit}h weekly</span>
              </div>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {error && <div className="popover-error">{error}</div>}

        <div className="form-group">
          <label htmlFor="taskCodeId">Task *</label>
          <select
            id="taskCodeId"
            value={selectedTaskId}
            onChange={(e) => setSelectedTaskId(e.target.value)}
            required
            data-testid="popover-task-select"
          >
            <option value="">Select a task...</option>
            {taskCodes.map((tc) => (
              <option key={tc.id} value={tc.id}>
                {tc.code} - {tc.name} (${tc.currentRate.toFixed(2)}/hr)
              </option>
            ))}
          </select>
        </div>

        {needsSupervisor && (
          <div className="form-group">
            <label htmlFor="supervisorName">Supervisor Present *</label>
            <input
              id="supervisorName"
              type="text"
              value={supervisorName}
              onChange={(e) => setSupervisorName(e.target.value)}
              placeholder="Name of supervising adult"
              required
              aria-describedby="supervisor-help"
              data-testid="popover-supervisor-input"
            />
            <span className="help-text" id="supervisor-help">
              {preview?.requirements.supervisorReason ||
                'This task requires a supervisor to be present'}
            </span>
          </div>
        )}

        {needsMealBreak && (
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={mealBreakConfirmed}
                onChange={(e) => setMealBreakConfirmed(e.target.checked)}
                aria-describedby="mealbreak-help"
                data-testid="popover-mealbreak-checkbox"
              />
              I confirm I will take a 30-minute meal break during this shift
            </label>
            <span className="help-text" id="mealbreak-help">
              {preview?.requirements.mealBreakReason ||
                'Required for shifts over 6 hours (workers under 18)'}
            </span>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="popover-notes">Notes</label>
          <textarea
            id="popover-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional — e.g., invoice reference, task description"
            maxLength={500}
            rows={2}
            data-testid="popover-notes"
          />
          {notes.length > 0 && (
            <span className="help-text">{notes.length}/500</span>
          )}
        </div>

        <div className="popover-actions">
          <button
            type="button"
            className="cancel-btn"
            onClick={onClose}
            disabled={submitting}
            data-testid="popover-cancel"
          >
            Cancel
          </button>
          <button
            type="submit"
            className={`assign-btn ${hasViolations ? 'has-violations' : ''}`}
            disabled={submitting || !selectedTaskId || hasViolations}
            data-testid="popover-assign"
            title={hasViolations ? 'Cannot create entry due to compliance violations' : undefined}
          >
            {submitting
              ? 'Creating...'
              : hasViolations
                ? 'Cannot Create'
                : dayCount > 1
                  ? `Create ${dayCount} Entries`
                  : 'Create Entry'}
          </button>
        </div>
      </form>
      </div>
    </div>
  );
}
