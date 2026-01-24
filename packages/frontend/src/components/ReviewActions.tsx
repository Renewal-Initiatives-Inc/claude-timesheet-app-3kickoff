import { useState } from 'react';
import './ReviewActions.css';

interface ReviewActionsProps {
  onApprove: (notes?: string) => Promise<boolean>;
  onReject: (notes: string) => Promise<boolean>;
  approving: boolean;
  rejecting: boolean;
  error: string | null;
}

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  title: string;
  message: string;
  confirmText: string;
  confirmStyle?: 'danger' | 'primary';
  isLoading?: boolean;
  children?: React.ReactNode;
}

function ConfirmModal({
  isOpen,
  onClose,
  onSubmit,
  title,
  message,
  confirmText,
  confirmStyle = 'primary',
  isLoading = false,
  children,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="review-modal-overlay" data-testid="reject-confirm-modal">
      <div className="review-modal">
        <div className="review-modal-header">
          <h3>{title}</h3>
          <button
            className="review-modal-close"
            onClick={onClose}
            disabled={isLoading}
            data-testid="review-modal-close-button"
          >
            &times;
          </button>
        </div>
        <div className="review-modal-body">
          <p>{message}</p>
          {children}
        </div>
        <div className="review-modal-footer">
          <button
            className="review-modal-cancel"
            onClick={onClose}
            disabled={isLoading}
            data-testid="review-modal-cancel-button"
          >
            Cancel
          </button>
          <button
            className={`review-modal-confirm review-modal-confirm--${confirmStyle}`}
            onClick={onSubmit}
            disabled={isLoading}
            data-testid="review-modal-confirm-button"
          >
            {isLoading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ReviewActions({
  onApprove,
  onReject,
  approving,
  rejecting,
  error,
}: ReviewActionsProps) {
  const [notes, setNotes] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleApprove = async () => {
    const success = await onApprove(notes || undefined);
    if (success) {
      // Navigation will be handled by parent
    }
  };

  const handleRejectClick = () => {
    setShowRejectModal(true);
    setRejectNotes('');
    setFieldErrors({});
  };

  const handleRejectSubmit = async () => {
    // Validate notes
    if (!rejectNotes.trim()) {
      setFieldErrors({ notes: 'Notes are required when rejecting a timesheet' });
      return;
    }
    if (rejectNotes.trim().length < 10) {
      setFieldErrors({ notes: 'Notes must be at least 10 characters' });
      return;
    }

    setFieldErrors({});
    const success = await onReject(rejectNotes.trim());
    if (success) {
      setShowRejectModal(false);
    }
  };

  const isProcessing = approving || rejecting;

  return (
    <div className="review-actions">
      <div className="review-actions-notes">
        <label htmlFor="supervisorNotes">Supervisor Notes (optional for approval)</label>
        <textarea
          id="supervisorNotes"
          data-testid="field-supervisorNotes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add any notes about this timesheet..."
          rows={3}
          disabled={isProcessing}
        />
      </div>

      {error && (
        <div className="review-actions-error" data-testid="error-review-actions">
          {error}
        </div>
      )}

      <div className="review-actions-buttons">
        <button
          className="review-action-button review-action-button--reject"
          onClick={handleRejectClick}
          disabled={isProcessing}
          data-testid="review-reject-button"
        >
          {rejecting ? 'Rejecting...' : 'Reject'}
        </button>
        <button
          className="review-action-button review-action-button--approve"
          onClick={handleApprove}
          disabled={isProcessing}
          data-testid="review-approve-button"
        >
          {approving ? 'Approving...' : 'Approve'}
        </button>
      </div>

      <ConfirmModal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        onSubmit={handleRejectSubmit}
        title="Reject Timesheet"
        message="Please provide feedback explaining why this timesheet is being rejected. The employee will see these notes and can make corrections before resubmitting."
        confirmText="Reject Timesheet"
        confirmStyle="danger"
        isLoading={rejecting}
      >
        <div className="review-modal-notes">
          <textarea
            id="rejectNotes"
            data-testid="field-rejectNotes"
            value={rejectNotes}
            onChange={(e) => {
              setRejectNotes(e.target.value);
              setFieldErrors({});
            }}
            placeholder="Explain why this timesheet is being rejected..."
            rows={4}
            disabled={rejecting}
          />
          {fieldErrors['notes'] && (
            <span className="review-modal-error" data-testid="error-field-notes">
              {fieldErrors['notes']}
            </span>
          )}
          <span className="review-modal-hint">
            {rejectNotes.length}/10 characters minimum
          </span>
        </div>
      </ConfirmModal>
    </div>
  );
}
