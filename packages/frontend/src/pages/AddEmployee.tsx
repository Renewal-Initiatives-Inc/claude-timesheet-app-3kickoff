import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerEmployee, ApiRequestError } from '../api/client.js';
import type { RequiredDocuments } from '@renewal/types';
import './AddEmployee.css';

export function AddEmployee() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [tempPassword, setTempPassword] = useState('');

  // Preview of required documents based on age
  const [previewAge, setPreviewAge] = useState<number | null>(null);
  const [previewDocs, setPreviewDocs] = useState<RequiredDocuments | null>(null);

  const calculateAge = (dob: string): number => {
    const today = new Date();
    const birth = new Date(dob + 'T00:00:00');
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const getRequiredDocs = (age: number): RequiredDocuments => {
    if (age < 12) {
      return { parentalConsent: false, workPermit: false, safetyTraining: false, coppaDisclosure: false };
    }
    if (age <= 13) {
      return { parentalConsent: true, workPermit: false, safetyTraining: true, coppaDisclosure: true };
    }
    if (age <= 17) {
      return { parentalConsent: true, workPermit: true, safetyTraining: true, coppaDisclosure: false };
    }
    return { parentalConsent: false, workPermit: false, safetyTraining: false, coppaDisclosure: false };
  };

  const handleDobChange = (dob: string) => {
    setDateOfBirth(dob);
    if (dob) {
      const age = calculateAge(dob);
      setPreviewAge(age);
      setPreviewDocs(getRequiredDocs(age));
    } else {
      setPreviewAge(null);
      setPreviewDocs(null);
    }
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setTempPassword(password);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await registerEmployee({
        name,
        email,
        dateOfBirth,
        isSupervisor,
        tempPassword,
      });

      // Navigate to the new employee's detail page
      navigate(`/employees/${response.employee.id}`, {
        state: { message: 'Employee created successfully. A welcome email has been sent.' },
      });
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Failed to create employee');
      }
    } finally {
      setLoading(false);
    }
  };

  const maxDate = new Date().toISOString().split('T')[0];
  const minDate = new Date();
  minDate.setFullYear(minDate.getFullYear() - 100);

  return (
    <div className="add-employee-page">
      <header className="page-header">
        <Link to="/employees" className="back-link">
          ← Back to Employees
        </Link>
        <h1>Add New Employee</h1>
      </header>

      <form onSubmit={handleSubmit} className="employee-form">
        {error && (
          <div className="form-error">
            {error}
            <button type="button" onClick={() => setError(null)} className="error-close" data-testid="add-employee-error-close-button">
              ×
            </button>
          </div>
        )}

        <div className="form-section">
          <h2>Basic Information</h2>

          <div className="form-field">
            <label htmlFor="name">Full Name *</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={255}
              disabled={loading}
              data-testid="field-name"
            />
          </div>

          <div className="form-field">
            <label htmlFor="email">Email Address *</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={255}
              disabled={loading}
              data-testid="field-email"
            />
          </div>

          <div className="form-field">
            <label htmlFor="dob">Date of Birth *</label>
            <input
              id="dob"
              type="date"
              value={dateOfBirth}
              onChange={(e) => handleDobChange(e.target.value)}
              required
              max={maxDate}
              min={minDate.toISOString().split('T')[0]}
              disabled={loading}
              data-testid="field-dateOfBirth"
            />
            {previewAge !== null && previewAge < 12 && (
              <p className="field-error">
                Employee must be at least 12 years old. Current age: {previewAge}
              </p>
            )}
          </div>

          <div className="form-field checkbox-field">
            <label>
              <input
                type="checkbox"
                checked={isSupervisor}
                onChange={(e) => setIsSupervisor(e.target.checked)}
                disabled={loading}
                data-testid="field-isSupervisor"
              />
              <span>Grant supervisor privileges</span>
            </label>
            <p className="field-hint">
              Supervisors can manage employees, approve timesheets, and access reports.
            </p>
          </div>
        </div>

        <div className="form-section">
          <h2>Temporary Password</h2>
          <p className="section-hint">
            This password will be sent to the employee's email address. They will be prompted to
            change it on first login.
          </p>

          <div className="form-field">
            <label htmlFor="password">Temporary Password *</label>
            <div className="password-input">
              <input
                id="password"
                type="text"
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                required
                minLength={8}
                disabled={loading}
                data-testid="field-tempPassword"
              />
              <button
                type="button"
                onClick={generatePassword}
                className="generate-button"
                disabled={loading}
                data-testid="add-employee-generate-password-button"
              >
                Generate
              </button>
            </div>
            <p className="field-hint">
              Must be at least 8 characters with letters and numbers.
            </p>
          </div>
        </div>

        {previewAge !== null && previewAge >= 12 && previewDocs && (
          <div className="form-section requirements-preview">
            <h2>Required Documentation</h2>
            <p className="section-hint">
              Based on the employee's age ({previewAge}), the following documents will be required:
            </p>

            <ul className="requirements-list">
              {previewDocs.parentalConsent && (
                <li>
                  <span className="req-icon">📝</span>
                  Parental Consent Form
                  {previewDocs.coppaDisclosure && (
                    <span className="coppa-note"> (includes COPPA disclosure)</span>
                  )}
                </li>
              )}
              {previewDocs.workPermit && (
                <li>
                  <span className="req-icon">📋</span>
                  Work Permit
                </li>
              )}
              {previewDocs.safetyTraining && (
                <li>
                  <span className="req-icon">🛡️</span>
                  Safety Training Verification
                </li>
              )}
              {!previewDocs.parentalConsent &&
                !previewDocs.workPermit &&
                !previewDocs.safetyTraining && (
                  <li className="no-requirements">
                    <span className="req-icon">✓</span>
                    No documentation required for employees 18 and older
                  </li>
                )}
            </ul>
          </div>
        )}

        <div className="form-actions">
          <Link to="/employees" className="cancel-button" data-testid="add-employee-cancel-button">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading || (previewAge !== null && previewAge < 12)}
            className="submit-button"
            data-testid="add-employee-submit-button"
          >
            {loading ? 'Creating...' : 'Create Employee'}
          </button>
        </div>
      </form>
    </div>
  );
}
