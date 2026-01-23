import { useState } from 'react';
import { useTaskCodeActions } from '../hooks/useTaskCodes.js';
import './AddRateModal.css';

interface AddRateModalProps {
  taskCodeId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddRateModal({ taskCodeId, onClose, onSuccess }: AddRateModalProps) {
  const { addRate, loading, error } = useTaskCodeActions();
  const [hourlyRate, setHourlyRate] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [justificationNotes, setJustificationNotes] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Get today's date in YYYY-MM-DD format for min attribute
  const today = new Date().toISOString().split('T')[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Validate inputs
    const rate = parseFloat(hourlyRate);
    if (isNaN(rate) || rate <= 0) {
      setValidationError('Please enter a valid hourly rate greater than 0');
      return;
    }

    if (!effectiveDate) {
      setValidationError('Please select an effective date');
      return;
    }

    if (effectiveDate < today!) {
      setValidationError('Effective date cannot be in the past');
      return;
    }

    try {
      await addRate(taskCodeId, {
        hourlyRate: rate,
        effectiveDate,
        justificationNotes: justificationNotes || undefined,
      });
      onSuccess();
    } catch {
      // Error is handled by the hook
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="add-rate-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h3>Add New Rate</h3>
          <button className="close-button" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          {(validationError || error) && (
            <div className="form-error">
              {validationError || error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="hourlyRate">Hourly Rate ($) *</label>
            <input
              id="hourlyRate"
              type="number"
              step="0.01"
              min="0.01"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              placeholder="e.g., 15.00"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="effectiveDate">Effective Date *</label>
            <input
              id="effectiveDate"
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              min={today}
              required
            />
            <span className="help-text">Date when this rate becomes active</span>
          </div>

          <div className="form-group">
            <label htmlFor="justificationNotes">Justification Notes</label>
            <textarea
              id="justificationNotes"
              value={justificationNotes}
              onChange={(e) => setJustificationNotes(e.target.value)}
              placeholder="Optional: Explain the reason for this rate change..."
              rows={3}
              maxLength={500}
            />
            <span className="help-text">Recommended for audit documentation</span>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="cancel-button"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="submit-button"
              disabled={loading}
            >
              {loading ? 'Adding...' : 'Add Rate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
