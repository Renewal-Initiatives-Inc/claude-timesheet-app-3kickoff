import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import './Login.css';

export function Login() {
  const { login, loading, error, clearError, isAuthenticated, isSupervisor } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const authError = searchParams.get('error');

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      // Check for stored return path (from ProtectedRoute redirect)
      const returnTo = sessionStorage.getItem('returnTo');
      sessionStorage.removeItem('returnTo');

      const defaultPath = isSupervisor ? '/dashboard' : '/timesheet';
      navigate(returnTo || defaultPath, { replace: true });
    }
  }, [isAuthenticated, isSupervisor, navigate]);

  const handleSignIn = async () => {
    try {
      await login();
    } catch {
      // Error is handled by useAuth
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Renewal Initiatives</h1>
        <p className="login-subtitle">Timesheet Management System</p>

        <div className="login-form">
          {(error || authError) && (
            <div className="login-error" data-testid="login-error">
              {error || (authError === 'auth_failed' ? 'Authentication failed. Please try again.' : authError)}
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

          <p className="login-info">
            Sign in with your Renewal Initiatives account to access the timesheet system.
          </p>

          <button
            onClick={handleSignIn}
            disabled={loading}
            className="login-button"
            data-testid="login-submit-button"
          >
            {loading ? 'Redirecting...' : 'Sign in with Renewal Initiatives'}
          </button>
        </div>
      </div>
    </div>
  );
}
