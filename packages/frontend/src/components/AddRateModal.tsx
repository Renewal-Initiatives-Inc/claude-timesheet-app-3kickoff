import { useState } from 'react';
import { useTaskCodeActions } from '../hooks/useTaskCodes.js';
import './AddRateModal.css';

interface AddRateModalProps {
  taskCodeId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddRateModal({ taskCodeId, onClose, onSuccess }: AddRateModalProps) {
  const { addRate, loading, error: apiError } = useTaskCodeActions();
  const [hourlyRate, setHourlyRate] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [justificationNotes, setJustificationNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Get today's date in YYYY-MM-DD format for min attribute
  const today = new Date().toISOString().split('T')[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate inputs
    const rate = parseFloat(hourlyRate);
    if (isNaN(rate) || rate <= 0) {
      setError('Please enter a valid hourly rate greater than 0');
      return;
    }

    if (!effectiveDate) {
      setError('Please select an effective date');
      return;
    }

    if (effectiveDate < today!) {
      setError('Effective date cannot be in the past');
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
      <div className="add-rate-modal" onClick={(e) => e.stopPropagation()} data-testid="add-rate-modal">
        <header className="modal-header">
          <h3>Add New Rate</h3>
          <button className="close-button" onClick={onClose} aria-label="Close" data-testid="add-rate-modal-close-button">
            &times;
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          {(error || apiError) && (
            <div className="form-error">
              {error || apiError}
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
              data-testid="field-hourlyRate"
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
              data-testid="field-effectiveDate"
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
              data-testid="field-justificationNotes"
            />
            <span className="help-text">Recommended for audit documentation</span>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="cancel-button"
              onClick={onClose}
              disabled={loading}
              data-testid="add-rate-modal-cancel-button"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="submit-button"
              disabled={loading}
              data-testid="add-rate-modal-submit-button"
            >
              {loading ? 'Adding...' : 'Add Rate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
