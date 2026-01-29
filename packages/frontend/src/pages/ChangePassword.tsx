import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { changePassword, ApiRequestError } from '../api/client.js';
import './Login.css';

export function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    // Validate password length
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword);

      // Log out after password change (sessions are revoked)
      await logout();

      // Redirect to login with success message
      navigate('/login', {
        replace: true,
        state: { message: 'Password changed successfully. Please log in with your new password.' },
      });
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Failed to change password');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Change Password</h1>
        <p className="login-subtitle">
          {user?.name}, please set a new password for your account.
        </p>

        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="login-error">
              {error}
              <button
                type="button"
                onClick={() => setError(null)}
                className="login-error-close"
                data-testid="change-password-error-close"
              >
                x
              </button>
            </div>
          )}

          <div className="login-field">
            <label htmlFor="currentPassword">Current Password</label>
            <input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={loading}
              data-testid="field-current-password"
            />
          </div>

          <div className="login-field">
            <label htmlFor="newPassword">New Password</label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              disabled={loading}
              data-testid="field-new-password"
            />
            <small>Must be at least 8 characters</small>
          </div>

          <div className="login-field">
            <label htmlFor="confirmPassword">Confirm New Password</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              disabled={loading}
              data-testid="field-confirm-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="login-button"
            data-testid="change-password-submit"
          >
            {loading ? 'Changing Password...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
