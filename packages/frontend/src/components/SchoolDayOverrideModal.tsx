import { useState } from 'react';
import './SchoolDayOverrideModal.css';

interface SchoolDayOverrideModalProps {
  date: string;
  currentIsSchoolDay: boolean;
  onSubmit: (note: string) => void;
  onClose: () => void;
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

export function SchoolDayOverrideModal({
  date,
  currentIsSchoolDay,
  onSubmit,
  onClose,
}: SchoolDayOverrideModalProps) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const newStatus = currentIsSchoolDay ? 'non-school day' : 'school day';
  const minLength = 10;

  const handleSubmit = () => {
    if (note.trim().length < minLength) {
      setError(`Please provide at least ${minLength} characters explaining the override.`);
      return;
    }
    onSubmit(note.trim());
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="school-day-override-modal"
        onClick={(e) => e.stopPropagation()}
        data-testid="school-day-override-modal"
      >
        <header className="modal-header">
          <h3>Override School Day Status</h3>
          <button
            className="close-button"
            onClick={onClose}
            aria-label="Close"
            data-testid="school-day-override-close-button"
          >
            &times;
          </button>
        </header>

        <div className="modal-body">
          <div className="override-info">
            <p className="date-text">
              <strong>{formatFullDate(date)}</strong>
            </p>
            <p className="change-text">
              You are marking this as a <strong>{newStatus}</strong>.
            </p>
          </div>

          <div className="warning-box">
            <span className="warning-icon">&#9888;</span>
            <div className="warning-content">
              <strong>Compliance Note</strong>
              <p>
                Changing the school day status affects which labor rules apply. Different hour
                limits may be enforced for school days vs. non-school days for workers under 18.
              </p>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="overrideNote">
              Reason for Override <span className="required">*</span>
            </label>
            <textarea
              id="overrideNote"
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                setError(null);
              }}
              placeholder="Explain why this date should be marked differently (e.g., school holiday, summer break, etc.)"
              rows={3}
              minLength={minLength}
              maxLength={500}
              data-testid="field-overrideNote"
            />
            <div className="char-count">
              {note.length} / 500 characters (minimum {minLength})
            </div>
            {error && <span className="field-error">{error}</span>}
          </div>
        </div>

        <div className="modal-actions">
          <button
            type="button"
            className="cancel-button"
            onClick={onClose}
            data-testid="school-day-override-cancel-button"
          >
            Cancel
          </button>
          <button
            type="button"
            className="confirm-button"
            onClick={handleSubmit}
            disabled={note.trim().length < minLength}
            data-testid="school-day-override-submit-button"
          >
            Confirm Override
          </button>
        </div>
      </div>
    </div>
  );
}
