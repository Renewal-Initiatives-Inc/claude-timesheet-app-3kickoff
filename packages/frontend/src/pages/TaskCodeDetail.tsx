import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTaskCode, useTaskCodeActions } from '../hooks/useTaskCodes.js';
import { AddRateModal } from '../components/AddRateModal.js';
import './TaskCodeDetail.css';

export function TaskCodeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { taskCode, loading, error, refetch } = useTaskCode(id);
  const { archiveTaskCode, loading: actionLoading, error: actionError } = useTaskCodeActions();
  const [showAddRateModal, setShowAddRateModal] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

  const handleArchive = async () => {
    if (!id) return;
    try {
      await archiveTaskCode(id);
      navigate('/task-codes');
    } catch {
      // Error is handled by the hook
    }
  };

  if (loading) {
    return (
      <div className="task-code-detail-page">
        <div className="loading">Loading task code...</div>
      </div>
    );
  }

  if (error || !taskCode) {
    return (
      <div className="task-code-detail-page">
        <div className="error-message">
          <p>Error: {error || 'Task code not found'}</p>
          <Link to="/task-codes" className="back-link">Back to Task Codes</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="task-code-detail-page">
      <header className="page-header">
        <div className="header-left">
          <Link to="/task-codes" className="back-link">&larr; Back to Task Codes</Link>
          <h1>
            <span className="task-code-badge">{taskCode.code}</span>
            {taskCode.name}
          </h1>
        </div>
        <div className="header-actions">
          <Link to={`/task-codes/${id}/edit`} className="edit-button" data-testid="task-code-edit-button">
            Edit
          </Link>
          {taskCode.isActive && (
            <button
              className="archive-button"
              onClick={() => setShowArchiveConfirm(true)}
              disabled={actionLoading}
              data-testid="task-code-archive-button"
            >
              Archive
            </button>
          )}
        </div>
      </header>

      {actionError && (
        <div className="action-error">
          Error: {actionError}
        </div>
      )}

      <div className="content-grid">
        <section className="info-section">
          <h2>Task Code Information</h2>
          <div className="info-grid">
            <div className="info-item">
              <label>Code</label>
              <span className="code-value">{taskCode.code}</span>
            </div>
            <div className="info-item">
              <label>Name</label>
              <span>{taskCode.name}</span>
            </div>
            <div className="info-item full-width">
              <label>Description</label>
              <span>{taskCode.description || 'No description provided'}</span>
            </div>
            <div className="info-item">
              <label>Type</label>
              <span className={`type-badge ${taskCode.isAgricultural ? 'type-agricultural' : 'type-non-agricultural'}`}>
                {taskCode.isAgricultural ? 'Agricultural' : 'Non-Agricultural'}
              </span>
            </div>
            <div className="info-item">
              <label>Status</label>
              <span className={`status-badge status-${taskCode.isActive ? 'active' : 'inactive'}`}>
                {taskCode.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="info-item">
              <label>Current Rate</label>
              <span className="rate-value">${taskCode.currentRate.toFixed(2)}/hr</span>
            </div>
            <div className="info-item">
              <label>Minimum Age</label>
              <span className="age-value">{taskCode.minAgeAllowed}+</span>
            </div>
          </div>
        </section>

        <section className="compliance-section">
          <h2>Compliance Attributes</h2>
          <div className="compliance-grid">
            <div className={`compliance-item ${taskCode.isHazardous ? 'active' : ''}`}>
              <span className="compliance-label">Hazardous Work</span>
              <span className={`compliance-value ${taskCode.isHazardous ? 'yes' : 'no'}`}>
                {taskCode.isHazardous ? 'Yes' : 'No'}
              </span>
            </div>
            <div className={`compliance-item ${taskCode.supervisorRequired !== 'none' ? 'active' : ''}`}>
              <span className="compliance-label">Supervisor Required</span>
              <span className="compliance-value">
                {taskCode.supervisorRequired === 'none' ? 'None' :
                 taskCode.supervisorRequired === 'for_minors' ? 'For Minors' : 'Always'}
              </span>
            </div>
            <div className={`compliance-item ${taskCode.soloCashHandling ? 'active' : ''}`}>
              <span className="compliance-label">Solo Cash Handling</span>
              <span className={`compliance-value ${taskCode.soloCashHandling ? 'yes' : 'no'}`}>
                {taskCode.soloCashHandling ? 'Yes' : 'No'}
              </span>
            </div>
            <div className={`compliance-item ${taskCode.drivingRequired ? 'active' : ''}`}>
              <span className="compliance-label">Driving Required</span>
              <span className={`compliance-value ${taskCode.drivingRequired ? 'yes' : 'no'}`}>
                {taskCode.drivingRequired ? 'Yes' : 'No'}
              </span>
            </div>
            <div className={`compliance-item ${taskCode.powerMachinery ? 'active' : ''}`}>
              <span className="compliance-label">Power Machinery</span>
              <span className={`compliance-value ${taskCode.powerMachinery ? 'yes' : 'no'}`}>
                {taskCode.powerMachinery ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
        </section>

        <section className="rates-section" data-testid="rate-history-section">
          <div className="section-header">
            <h2>Rate History</h2>
            <button
              className="add-rate-button"
              onClick={() => setShowAddRateModal(true)}
              data-testid="task-code-add-rate-button"
            >
              + Add New Rate
            </button>
          </div>
          {taskCode.rateHistory.length === 0 ? (
            <p className="no-rates">No rate history available.</p>
          ) : (
            <table className="rates-table" data-testid="rate-history-table">
              <thead>
                <tr>
                  <th>Effective Date</th>
                  <th>Hourly Rate</th>
                  <th>Justification Notes</th>
                </tr>
              </thead>
              <tbody>
                {taskCode.rateHistory.map((rate) => (
                  <tr key={rate.id}>
                    <td>{new Date(rate.effectiveDate).toLocaleDateString()}</td>
                    <td className="rate-cell">${parseFloat(rate.hourlyRate).toFixed(2)}</td>
                    <td className="notes-cell">{rate.justificationNotes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {showAddRateModal && (
        <AddRateModal
          taskCodeId={id!}
          onClose={() => setShowAddRateModal(false)}
          onSuccess={() => {
            setShowAddRateModal(false);
            refetch();
          }}
        />
      )}

      {showArchiveConfirm && (
        <div className="modal-overlay">
          <div className="confirm-modal">
            <h3>Archive Task Code</h3>
            <p>
              Are you sure you want to archive task code <strong>{taskCode.code}</strong>?
              This will hide it from the default task code list.
            </p>
            <div className="modal-actions">
              <button
                className="cancel-button"
                onClick={() => setShowArchiveConfirm(false)}
                disabled={actionLoading}
                data-testid="task-code-archive-cancel-button"
              >
                Cancel
              </button>
              <button
                className="confirm-archive-button"
                onClick={handleArchive}
                disabled={actionLoading}
                data-testid="task-code-archive-confirm-button"
              >
                {actionLoading ? 'Archiving...' : 'Archive'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
