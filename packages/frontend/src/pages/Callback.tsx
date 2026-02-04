import { useEffect } from 'react';
import { useAuth } from 'react-oidc-context';
import { useNavigate } from 'react-router-dom';

export function Callback() {
  const auth = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!auth.isLoading) {
      if (auth.isAuthenticated) {
        // Get the return URL from session storage, or use default
        const returnTo = sessionStorage.getItem('returnTo') || '/timesheet';
        sessionStorage.removeItem('returnTo');
        navigate(returnTo, { replace: true });
      } else if (auth.error) {
        console.error('Authentication error:', auth.error);
        navigate('/login?error=auth_failed', { replace: true });
      }
    }
  }, [auth.isLoading, auth.isAuthenticated, auth.error, navigate]);

  return (
    <div className="callback-page">
      <div className="callback-content">
        <div className="loading-spinner" aria-hidden="true" />
        <p>Completing sign in...</p>
      </div>
    </div>
  );
}
