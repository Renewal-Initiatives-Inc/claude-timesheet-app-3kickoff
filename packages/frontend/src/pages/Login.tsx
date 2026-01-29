import { useState, FormEvent } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import './Login.css';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, loading, error, clearError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const response = await login({ email, password });

      // Check if password change is required (new employee with temp password)
      if (response.requiresPasswordChange) {
        navigate('/change-password', { replace: true });
        return;
      }

      // Role-based default redirect: employees go to timesheet, supervisors go to dashboard
      const defaultPath = response.employee.isSupervisor ? '/dashboard' : '/timesheet';
      const from = (location.state as { from?: string })?.from || defaultPath;
      navigate(from, { replace: true });
    } catch {
      // Error is handled by useAuth
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Renewal Initiatives</h1>
        <p className="login-subtitle">Timesheet Management System</p>

        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="login-error">
              {error}
              <button
                type="button"
                onClick={clearError}
                className="login-error-close"
                data-testid="login-error-close-button"
              >
                ×
              </button>
            </div>
          )}

          <div className="login-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={loading}
              data-testid="field-email"
            />
          </div>

          <div className="login-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={loading}
              data-testid="field-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="login-button"
            data-testid="login-submit-button"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="login-footer">
          <Link to="/password-reset" data-testid="login-forgot-password-link">
            Forgot password?
          </Link>
        </div>
      </div>
    </div>
  );
}
