import { useState, useEffect } from 'react';
import type {
  CreateEntryRequest,
  UpdateEntryRequest,
  TimesheetEntryWithTaskCode,
} from '@renewal/types';
import { useTaskCodesForEmployee } from '../hooks/useTaskCodes.js';
import { useFunds } from '../hooks/useFunds.js';
import './EntryFormModal.css';

interface EntryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (entry: CreateEntryRequest | UpdateEntryRequest) => Promise<void>;
  entry?: TimesheetEntryWithTaskCode; // If editing existing entry
  date: string;
  employeeId: string;
  employeeAge: number;
  isSchoolDay: boolean;
}

/**
 * Calculate hours from start and end time strings.
 */
function calculateDisplayHours(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;

  const [startHours, startMinutes] = startTime.split(':').map(Number);
  const [endHours, endMinutes] = endTime.split(':').map(Number);

  const startTotalMinutes = (startHours ?? 0) * 60 + (startMinutes ?? 0);
  const endTotalMinutes = (endHours ?? 0) * 60 + (endMinutes ?? 0);

  if (endTotalMinutes <= startTotalMinutes) return 0;

  return (endTotalMinutes - startTotalMinutes) / 60;
}

/**
 * Format date like "Monday, January 15, 2025"
 */
function formatFullDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

interface EntryFormData {
  taskCodeId: string;
  startTime: string;
  endTime: string;
  supervisorPresentName: string;
  mealBreakConfirmed: boolean | null;
  notes: string;
  fundId: string; // '' = General Fund (default), otherwise fund.id as string
}

interface FormErrors {
  taskCodeId?: string;
  startTime?: string;
  endTime?: string;
  supervisorPresentName?: string;
  mealBreakConfirmed?: string;
  notes?: string;
  submit?: string;
}

export function EntryFormModal({
  isOpen,
  onClose,
  onSubmit,
  entry,
  date,
  employeeId,
  employeeAge,
  isSchoolDay,
}: EntryFormModalProps) {
  const { taskCodes, loading: loadingTasks } = useTaskCodesForEmployee(employeeId, date);
  const { funds, loading: loadingFunds } = useFunds();
  const [formData, setFormData] = useState<EntryFormData>({
    taskCodeId: '',
    startTime: '',
    endTime: '',
    supervisorPresentName: '',
    mealBreakConfirmed: null,
    notes: '',
    fundId: '',
  });
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // Initialize form data when entry changes (edit mode)
  useEffect(() => {
    if (entry) {
      setFormData({
        taskCodeId: entry.taskCodeId,
        startTime: entry.startTime.slice(0, 5),
        endTime: entry.endTime.slice(0, 5),
        supervisorPresentName: entry.supervisorPresentName || '',
        mealBreakConfirmed: entry.mealBreakConfirmed,
        notes: entry.notes || '',
        fundId: entry.fundId != null ? String(entry.fundId) : '',
      });
    } else {
      setFormData({
        taskCodeId: '',
        startTime: '',
        endTime: '',
        supervisorPresentName: '',
        mealBreakConfirmed: null,
        notes: '',
        fundId: '',
      });
    }
    setFieldErrors({});
  }, [entry, isOpen]);

  if (!isOpen) return null;

  const selectedTask = taskCodes.find((tc) => tc.id === formData.taskCodeId);
  const calculatedHours = calculateDisplayHours(formData.startTime, formData.endTime);
  const needsSupervisorAttestation =
    selectedTask &&
    (selectedTask.supervisorRequired === 'always' ||
      (selectedTask.supervisorRequired === 'for_minors' && employeeAge < 18));
  const needsMealBreakConfirmation = calculatedHours > 6 && employeeAge < 18;

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.taskCodeId) {
      newErrors.taskCodeId = 'Please select a task';
    }
    if (!formData.startTime) {
      newErrors.startTime = 'Start time is required';
    }
    if (!formData.endTime) {
      newErrors.endTime = 'End time is required';
    }
    if (formData.startTime && formData.endTime && formData.startTime >= formData.endTime) {
      newErrors.endTime = 'End time must be after start time';
    }
    if (needsSupervisorAttestation && !formData.supervisorPresentName.trim()) {
      newErrors.supervisorPresentName = 'Supervisor name is required for this task';
    }
    if (needsMealBreakConfirmation && formData.mealBreakConfirmed === null) {
      newErrors.mealBreakConfirmed = 'Please confirm if you took a meal break';
    }

    setFieldErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setSubmitting(true);
    try {
      const parsedFundId = formData.fundId ? Number(formData.fundId) : null;
      const data: CreateEntryRequest | UpdateEntryRequest = entry
        ? {
            startTime: formData.startTime,
            endTime: formData.endTime,
            taskCodeId: formData.taskCodeId,
            supervisorPresentName: needsSupervisorAttestation
              ? formData.supervisorPresentName
              : null,
            mealBreakConfirmed: needsMealBreakConfirmation ? formData.mealBreakConfirmed : null,
            notes: formData.notes.trim() || null,
            fundId: parsedFundId,
          }
        : {
            workDate: date,
            taskCodeId: formData.taskCodeId,
            startTime: formData.startTime,
            endTime: formData.endTime,
            isSchoolDay,
            supervisorPresentName: needsSupervisorAttestation
              ? formData.supervisorPresentName
              : null,
            mealBreakConfirmed: needsMealBreakConfirmation ? formData.mealBreakConfirmed : null,
            notes: formData.notes.trim() || null,
            fundId: parsedFundId,
          };

      await onSubmit(data);
      onClose();
    } catch (err) {
      setFieldErrors({ submit: err instanceof Error ? err.message : 'Failed to save' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="entry-form-modal"
        onClick={(e) => e.stopPropagation()}
        data-testid="entry-form-modal"
      >
        <header className="modal-header">
          <h3>{entry ? 'Edit Entry' : 'Add Entry'}</h3>
          <span className="modal-date">{formatFullDate(date)}</span>
          <button
            className="close-button"
            onClick={onClose}
            aria-label="Close"
            data-testid="entry-form-close-button"
          >
            &times;
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          {fieldErrors.submit && <div className="form-error">{fieldErrors.submit}</div>}

          <div className="form-group">
            <label htmlFor="taskCodeId">Task *</label>
            {loadingTasks ? (
              <div className="loading-tasks">Loading tasks...</div>
            ) : (
              <select
                id="taskCodeId"
                value={formData.taskCodeId}
                onChange={(e) => setFormData((prev) => ({ ...prev, taskCodeId: e.target.value }))}
                required
                data-testid="field-taskCodeId"
              >
                <option value="">Select a task...</option>
                {taskCodes.map((tc) => (
                  <option key={tc.id} value={tc.id}>
                    {tc.code} - {tc.name} (${tc.currentRate.toFixed(2)}/hr)
                  </option>
                ))}
              </select>
            )}
            {fieldErrors.taskCodeId && (
              <span className="field-error">{fieldErrors.taskCodeId}</span>
            )}
          </div>

          {funds.length > 0 && (
            <div className="form-group">
              <label htmlFor="fundId">Fund</label>
              {loadingFunds ? (
                <div className="loading-tasks">Loading funds...</div>
              ) : (
                <select
                  id="fundId"
                  value={formData.fundId}
                  onChange={(e) => setFormData((prev) => ({ ...prev, fundId: e.target.value }))}
                  data-testid="field-fundId"
                >
                  <option value="">General Fund (Default)</option>
                  {funds.map((fund) => (
                    <option key={fund.id} value={fund.id}>
                      {fund.fundCode} - {fund.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="startTime">Start Time *</label>
              <input
                id="startTime"
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData((prev) => ({ ...prev, startTime: e.target.value }))}
                required
                data-testid="field-startTime"
              />
              {fieldErrors.startTime && (
                <span className="field-error">{fieldErrors.startTime}</span>
              )}
            </div>
            <div className="form-group">
              <label htmlFor="endTime">End Time *</label>
              <input
                id="endTime"
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData((prev) => ({ ...prev, endTime: e.target.value }))}
                required
                data-testid="field-endTime"
              />
              {fieldErrors.endTime && <span className="field-error">{fieldErrors.endTime}</span>}
            </div>
          </div>

          <div className="calculated-hours">
            <span className="hours-label">Hours:</span>
            <span className="hours-value">{calculatedHours.toFixed(2)}</span>
          </div>

          {needsSupervisorAttestation && (
            <div className="form-group supervisor-field">
              <label htmlFor="supervisorPresentName">Supervisor Present *</label>
              <input
                id="supervisorPresentName"
                type="text"
                value={formData.supervisorPresentName}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, supervisorPresentName: e.target.value }))
                }
                placeholder="Name of supervising adult"
                required
                data-testid="field-supervisorPresentName"
              />
              <span className="help-text">This task requires a supervisor to be present</span>
              {fieldErrors.supervisorPresentName && (
                <span className="field-error">{fieldErrors.supervisorPresentName}</span>
              )}
            </div>
          )}

          {needsMealBreakConfirmation && (
            <div className="form-group meal-break-field">
              <label>Meal Break Confirmation *</label>
              <div className="checkbox-field">
                <input
                  id="mealBreakConfirmed"
                  type="checkbox"
                  checked={formData.mealBreakConfirmed === true}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, mealBreakConfirmed: e.target.checked }))
                  }
                  data-testid="field-mealBreakConfirmed"
                />
                <label htmlFor="mealBreakConfirmed">
                  I confirm I took a 30-minute meal break during this shift
                </label>
              </div>
              <span className="help-text">Required for shifts over 6 hours (workers under 18)</span>
              {fieldErrors.mealBreakConfirmed && (
                <span className="field-error">{fieldErrors.mealBreakConfirmed}</span>
              )}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="notes">Notes</label>
            <textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Optional — e.g., invoice reference, task description"
              maxLength={500}
              rows={2}
              data-testid="field-notes"
            />
            {formData.notes.length > 0 && (
              <span className="help-text">{formData.notes.length}/500</span>
            )}
            {fieldErrors.notes && (
              <span className="field-error">{fieldErrors.notes}</span>
            )}
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="cancel-button"
              onClick={onClose}
              disabled={submitting}
              data-testid="entry-form-cancel-button"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="submit-button"
              disabled={submitting}
              data-testid="entry-form-submit-button"
            >
              {submitting ? 'Saving...' : entry ? 'Update' : 'Add Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
