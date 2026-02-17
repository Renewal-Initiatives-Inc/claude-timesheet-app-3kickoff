import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTaskCodes } from '../hooks/useTaskCodes.js';
import { getFunds, syncFunds } from '../api/client.js';
import './TaskCodeList.css';

export function TaskCodeList() {
  const [isAgricultural, setIsAgricultural] = useState<'true' | 'false' | ''>('');
  const [isHazardous, setIsHazardous] = useState<'true' | 'false' | ''>('');
  const [includeInactive, setIncludeInactive] = useState<'true' | 'false'>('false');
  const [search, setSearch] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  useEffect(() => {
    getFunds().then((res) => setLastSyncedAt(res.lastSyncedAt)).catch(() => {});
  }, []);

  const { taskCodes, loading, error, refetch } = useTaskCodes({
    isAgricultural: isAgricultural || undefined,
    isHazardous: isHazardous || undefined,
    includeInactive,
    search: search || undefined,
  });

  return (
    <div className="task-code-list-page">
      <header className="page-header">
        <h1>Task Codes</h1>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
            <button
              className="sync-funds-button"
              data-testid="sync-funds-button"
              disabled={syncing}
              onClick={async () => {
                setSyncing(true);
                setSyncMessage('');
                try {
                  const result = await syncFunds();
                  setSyncMessage(`Synced ${result.synced} funds`);
                  setLastSyncedAt(new Date().toISOString());
                  setTimeout(() => setSyncMessage(''), 4000);
                } catch (err) {
                  setSyncMessage(err instanceof Error ? err.message : 'Sync failed');
                  setTimeout(() => setSyncMessage(''), 6000);
                } finally {
                  setSyncing(false);
                }
              }}
            >
              {syncing ? 'Syncing...' : 'Sync Funds'}
            </button>
            {lastSyncedAt && (
              <span className="sync-timestamp" data-testid="sync-timestamp">
                Last: {new Date(lastSyncedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}{' '}
                {new Date(lastSyncedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
              </span>
            )}
          </div>
          <Link to="/task-codes/new" className="add-button" data-testid="task-code-add-button">
            + Add Task Code
          </Link>
        </div>
      </header>
      {syncMessage && (
        <div style={{ padding: '0.5rem 1rem', marginBottom: '1rem', background: syncMessage.includes('failed') || syncMessage.includes('Failed') ? '#fef2f2' : '#f0fdf4', border: `1px solid ${syncMessage.includes('failed') || syncMessage.includes('Failed') ? '#fecaca' : '#bbf7d0'}`, borderRadius: '6px', fontSize: '0.875rem' }}>
          {syncMessage}
        </div>
      )}

      <div className="filters">
        <div className="filter-group">
          <label htmlFor="type-filter">Type</label>
          <select
            id="type-filter"
            value={isAgricultural}
            onChange={(e) => setIsAgricultural(e.target.value as typeof isAgricultural)}
            data-testid="field-isAgricultural"
          >
            <option value="">All Types</option>
            <option value="true">Agricultural</option>
            <option value="false">Non-Agricultural</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="hazard-filter">Hazardous</label>
          <select
            id="hazard-filter"
            value={isHazardous}
            onChange={(e) => setIsHazardous(e.target.value as typeof isHazardous)}
            data-testid="field-isHazardous"
          >
            <option value="">All</option>
            <option value="true">Hazardous Only</option>
            <option value="false">Non-Hazardous Only</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="status-filter">Status</label>
          <select
            id="status-filter"
            value={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.value as typeof includeInactive)}
            data-testid="field-includeInactive"
          >
            <option value="false">Active Only</option>
            <option value="true">Include Inactive</option>
          </select>
        </div>

        <div className="filter-group search-group">
          <label htmlFor="search">Search</label>
          <input
            id="search"
            type="text"
            placeholder="Search by code or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="field-search"
          />
        </div>
      </div>

      {loading && <div className="loading">Loading task codes...</div>}

      {error && (
        <div className="error-message">
          <p>Error: {error}</p>
          <button onClick={refetch} data-testid="task-code-list-retry-button">
            Retry
          </button>
        </div>
      )}

      {!loading && !error && taskCodes.length === 0 && (
        <div className="empty-state">
          <p>No task codes found.</p>
          {search && <p>Try adjusting your search criteria.</p>}
        </div>
      )}

      {!loading && !error && taskCodes.length > 0 && (
        <table className="task-codes-table" data-testid="task-codes-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Type</th>
              <th>Min Age</th>
              <th>Current Rate</th>
              <th>Status</th>
              <th>Attributes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {taskCodes.map((taskCode) => (
              <tr
                key={taskCode.id}
                className={!taskCode.isActive ? 'inactive-row' : ''}
                data-testid={`task-code-row-${taskCode.code}`}
              >
                <td>
                  <Link to={`/task-codes/${taskCode.id}`} className="task-code-link">
                    {taskCode.code}
                  </Link>
                </td>
                <td className="name-cell">{taskCode.name}</td>
                <td>
                  <span
                    className={`type-badge ${taskCode.isAgricultural ? 'type-agricultural' : 'type-non-agricultural'}`}
                    data-testid="task-code-type-badge"
                  >
                    {taskCode.isAgricultural ? 'Agricultural' : 'Non-Agricultural'}
                  </span>
                </td>
                <td>
                  <span className={`age-badge age-${taskCode.minAgeAllowed}`}>
                    {taskCode.minAgeAllowed}+
                  </span>
                </td>
                <td className="rate-cell">${taskCode.currentRate.toFixed(2)}/hr</td>
                <td>
                  <span
                    className={`status-badge status-${taskCode.isActive ? 'active' : 'inactive'}`}
                  >
                    {taskCode.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="attributes-cell">
                  {taskCode.isHazardous && (
                    <span className="attribute-badge hazard-badge" title="Hazardous">
                      Hazard
                    </span>
                  )}
                  {taskCode.supervisorRequired !== 'none' && (
                    <span
                      className="attribute-badge supervisor-badge"
                      title={`Supervisor: ${taskCode.supervisorRequired}`}
                    >
                      Supv: {taskCode.supervisorRequired === 'for_minors' ? 'Minors' : 'Always'}
                    </span>
                  )}
                  {taskCode.drivingRequired && (
                    <span className="attribute-badge driving-badge" title="Driving Required">
                      Drive
                    </span>
                  )}
                  {taskCode.powerMachinery && (
                    <span className="attribute-badge machinery-badge" title="Power Machinery">
                      Mach
                    </span>
                  )}
                  {taskCode.soloCashHandling && (
                    <span className="attribute-badge cash-badge" title="Solo Cash Handling">
                      Cash
                    </span>
                  )}
                </td>
                <td>
                  <Link
                    to={`/task-codes/${taskCode.id}`}
                    className="view-link"
                    data-testid={`task-code-view-${taskCode.code}`}
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
