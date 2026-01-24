import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import type { SupervisorRequired, CreateTaskCodeRequest, UpdateTaskCodeRequest } from '@renewal/types';
import { useTaskCode, useTaskCodeActions } from '../hooks/useTaskCodes.js';
import './TaskCodeForm.css';

interface TaskCodeFormProps {
  mode: 'create' | 'edit';
}

export function TaskCodeForm({ mode }: TaskCodeFormProps) {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { taskCode, loading: loadingTaskCode } = useTaskCode(mode === 'edit' ? id : undefined);
  const { createTaskCode, updateTaskCode, loading, error } = useTaskCodeActions();

  // Form state
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isAgricultural, setIsAgricultural] = useState(false);
  const [isHazardous, setIsHazardous] = useState(false);
  const [supervisorRequired, setSupervisorRequired] = useState<SupervisorRequired>('none');
  const [minAgeAllowed, setMinAgeAllowed] = useState(12);
  const [soloCashHandling, setSoloCashHandling] = useState(false);
  const [drivingRequired, setDrivingRequired] = useState(false);
  const [powerMachinery, setPowerMachinery] = useState(false);
  const [initialRate, setInitialRate] = useState('');
  const [rateEffectiveDate, setRateEffectiveDate] = useState('');
  const [rateJustificationNotes, setRateJustificationNotes] = useState('');

  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Get today's date for the date picker
  const today = new Date().toISOString().split('T')[0];

  // Populate form when editing
  useEffect(() => {
    if (mode === 'edit' && taskCode) {
      setCode(taskCode.code);
      setName(taskCode.name);
      setDescription(taskCode.description || '');
      setIsAgricultural(taskCode.isAgricultural);
      setIsHazardous(taskCode.isHazardous);
      setSupervisorRequired(taskCode.supervisorRequired);
      setMinAgeAllowed(taskCode.minAgeAllowed);
      setSoloCashHandling(taskCode.soloCashHandling);
      setDrivingRequired(taskCode.drivingRequired);
      setPowerMachinery(taskCode.powerMachinery);
    }
  }, [mode, taskCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setSuccessMessage(null);

    // Validate code format
    if (mode === 'create' && !/^[A-Z0-9-]+$/i.test(code)) {
      setValidationError('Code must contain only letters, numbers, and hyphens');
      return;
    }

    if (!name.trim()) {
      setValidationError('Name is required');
      return;
    }

    if (mode === 'create') {
      const rate = parseFloat(initialRate);
      if (isNaN(rate) || rate <= 0) {
        setValidationError('Please enter a valid initial rate greater than 0');
        return;
      }

      if (!rateEffectiveDate) {
        setValidationError('Rate effective date is required');
        return;
      }

      const data: CreateTaskCodeRequest = {
        code: code.toUpperCase(),
        name: name.trim(),
        description: description.trim() || undefined,
        isAgricultural,
        isHazardous,
        supervisorRequired,
        minAgeAllowed,
        soloCashHandling,
        drivingRequired,
        powerMachinery,
        initialRate: rate,
        rateEffectiveDate,
        rateJustificationNotes: rateJustificationNotes.trim() || undefined,
      };

      try {
        await createTaskCode(data);
        setSuccessMessage('Task code created successfully!');
        setTimeout(() => {
          navigate('/task-codes');
        }, 1500);
      } catch {
        // Error is handled by the hook
      }
    } else {
      const data: UpdateTaskCodeRequest = {
        name: name.trim(),
        description: description.trim() || undefined,
        isAgricultural,
        isHazardous,
        supervisorRequired,
        minAgeAllowed,
        soloCashHandling,
        drivingRequired,
        powerMachinery,
      };

      try {
        await updateTaskCode(id!, data);
        setSuccessMessage('Task code updated successfully!');
        setTimeout(() => {
          navigate(`/task-codes/${id}`);
        }, 1500);
      } catch {
        // Error is handled by the hook
      }
    }
  };

  if (mode === 'edit' && loadingTaskCode) {
    return (
      <div className="task-code-form-page">
        <div className="loading">Loading task code...</div>
      </div>
    );
  }

  if (mode === 'edit' && !taskCode && !loadingTaskCode) {
    return (
      <div className="task-code-form-page">
        <div className="error-message">
          <p>Task code not found</p>
          <Link to="/task-codes" className="back-link">Back to Task Codes</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="task-code-form-page">
      <header className="page-header">
        <Link to={mode === 'edit' ? `/task-codes/${id}` : '/task-codes'} className="back-link">
          &larr; {mode === 'edit' ? 'Back to Task Code' : 'Back to Task Codes'}
        </Link>
        <h1>{mode === 'create' ? 'Add New Task Code' : `Edit Task Code: ${taskCode?.code}`}</h1>
      </header>

      <form className="task-code-form" onSubmit={handleSubmit}>
        {successMessage && (
          <div className="success-message">{successMessage}</div>
        )}

        {(validationError || error) && (
          <div className="form-error">{validationError || error}</div>
        )}

        <section className="form-section">
          <h2>Basic Information</h2>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="code">Code *</label>
              <input
                id="code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g., F1, R2, A1"
                maxLength={10}
                disabled={mode === 'edit'}
                required
                data-testid="field-code"
              />
              {mode === 'edit' && (
                <span className="help-text">Code cannot be changed after creation</span>
              )}
            </div>

            <div className="form-group flex-2">
              <label htmlFor="name">Name *</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Field Preparation"
                maxLength={100}
                required
                data-testid="field-name"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description of this task code..."
              rows={3}
              maxLength={500}
              data-testid="field-description"
            />
          </div>
        </section>

        <section className="form-section">
          <h2>Classification</h2>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="type">Work Type *</label>
              <select
                id="type"
                value={isAgricultural ? 'agricultural' : 'non-agricultural'}
                onChange={(e) => setIsAgricultural(e.target.value === 'agricultural')}
                data-testid="field-type"
              >
                <option value="agricultural">Agricultural</option>
                <option value="non-agricultural">Non-Agricultural</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="minAge">Minimum Age *</label>
              <select
                id="minAge"
                value={minAgeAllowed}
                onChange={(e) => setMinAgeAllowed(parseInt(e.target.value))}
                data-testid="field-minAge"
              >
                <option value={12}>12+</option>
                <option value={14}>14+</option>
                <option value={16}>16+</option>
                <option value={18}>18+</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="supervisor">Supervisor Required *</label>
              <select
                id="supervisor"
                value={supervisorRequired}
                onChange={(e) => setSupervisorRequired(e.target.value as SupervisorRequired)}
                data-testid="field-supervisor"
              >
                <option value="none">None</option>
                <option value="for_minors">For Minors</option>
                <option value="always">Always</option>
              </select>
            </div>
          </div>
        </section>

        <section className="form-section">
          <h2>Compliance Attributes</h2>

          <div className="checkbox-grid">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={isHazardous}
                onChange={(e) => setIsHazardous(e.target.checked)}
                data-testid="field-isHazardous"
              />
              <span className="checkbox-text">
                <strong>Hazardous Work</strong>
                <small>Task involves dangerous conditions or equipment</small>
              </span>
            </label>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={soloCashHandling}
                onChange={(e) => setSoloCashHandling(e.target.checked)}
                data-testid="field-soloCashHandling"
              />
              <span className="checkbox-text">
                <strong>Solo Cash Handling</strong>
                <small>Task involves handling money without supervision</small>
              </span>
            </label>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={drivingRequired}
                onChange={(e) => setDrivingRequired(e.target.checked)}
                data-testid="field-drivingRequired"
              />
              <span className="checkbox-text">
                <strong>Driving Required</strong>
                <small>Task requires operating a vehicle</small>
              </span>
            </label>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={powerMachinery}
                onChange={(e) => setPowerMachinery(e.target.checked)}
                data-testid="field-powerMachinery"
              />
              <span className="checkbox-text">
                <strong>Power Machinery</strong>
                <small>Task involves operating power equipment</small>
              </span>
            </label>
          </div>
        </section>

        {mode === 'create' && (
          <section className="form-section">
            <h2>Initial Rate</h2>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="initialRate">Hourly Rate ($) *</label>
                <input
                  id="initialRate"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={initialRate}
                  onChange={(e) => setInitialRate(e.target.value)}
                  placeholder="e.g., 15.00"
                  required
                  data-testid="field-initialRate"
                />
              </div>

              <div className="form-group">
                <label htmlFor="effectiveDate">Effective Date *</label>
                <input
                  id="effectiveDate"
                  type="date"
                  value={rateEffectiveDate}
                  onChange={(e) => setRateEffectiveDate(e.target.value)}
                  min={today}
                  required
                  data-testid="field-rateEffectiveDate"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="rateNotes">Rate Justification Notes</label>
              <textarea
                id="rateNotes"
                value={rateJustificationNotes}
                onChange={(e) => setRateJustificationNotes(e.target.value)}
                placeholder="Optional: Document the rationale for this rate..."
                rows={2}
                maxLength={500}
                data-testid="field-rateJustificationNotes"
              />
              <span className="help-text">Recommended for audit documentation</span>
            </div>
          </section>
        )}

        <div className="form-actions">
          <Link
            to={mode === 'edit' ? `/task-codes/${id}` : '/task-codes'}
            className="cancel-button"
            data-testid="task-code-cancel-button"
          >
            Cancel
          </Link>
          <button type="submit" className="submit-button" disabled={loading} data-testid="task-code-submit-button">
            {loading ? 'Saving...' : mode === 'create' ? 'Create Task Code' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
