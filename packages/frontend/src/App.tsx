import { useEffect, useState } from 'react';
import type { HealthResponse } from '@renewal/types';

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error: ${res.status}`);
        }
        return res.json() as Promise<HealthResponse>;
      })
      .then(setHealth)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <div className="app">
      <h1>Renewal Initiatives Timesheet</h1>
      <p>Compliance-first timesheet application for youth workers.</p>

      <section className="status">
        <h2>System Status</h2>
        {error && <p className="error">Error: {error}</p>}
        {health && (
          <div className="health">
            <p>
              Status: <strong>{health.status}</strong>
            </p>
            <p>
              Last checked: <code>{health.timestamp}</code>
            </p>
          </div>
        )}
        {!health && !error && <p>Loading...</p>}
      </section>
    </div>
  );
}

export default App;
