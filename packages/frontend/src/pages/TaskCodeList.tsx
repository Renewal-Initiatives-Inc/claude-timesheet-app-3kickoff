import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTaskCodes } from '../hooks/useTaskCodes.js';
import './TaskCodeList.css';

export function TaskCodeList() {
  const [isAgricultural, setIsAgricultural] = useState<'true' | 'false' | ''>('');
  const [isHazardous, setIsHazardous] = useState<'true' | 'false' | ''>('');
  const [includeInactive, setIncludeInactive] = useState<'true' | 'false'>('false');
  const [search, setSearch] = useState('');

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
        <Link to="/task-codes/new" className="add-button">
          + Add Task Code
        </Link>
      </header>

      <div className="filters">
        <div className="filter-group">
          <label htmlFor="type-filter">Type</label>
          <select
            id="type-filter"
            value={isAgricultural}
            onChange={(e) => setIsAgricultural(e.target.value as typeof isAgricultural)}
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
          />
        </div>
      </div>

      {loading && <div className="loading">Loading task codes...</div>}

      {error && (
        <div className="error-message">
          <p>Error: {error}</p>
          <button onClick={refetch}>Retry</button>
        </div>
      )}

      {!loading && !error && taskCodes.length === 0 && (
        <div className="empty-state">
          <p>No task codes found.</p>
          {search && <p>Try adjusting your search criteria.</p>}
        </div>
      )}

      {!loading && !error && taskCodes.length > 0 && (
        <table className="task-codes-table">
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
              >
                <td>
                  <Link to={`/task-codes/${taskCode.id}`} className="task-code-link">
                    {taskCode.code}
                  </Link>
                </td>
                <td className="name-cell">{taskCode.name}</td>
                <td>
                  <span className={`type-badge ${taskCode.isAgricultural ? 'type-agricultural' : 'type-non-agricultural'}`}>
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
                  <span className={`status-badge status-${taskCode.isActive ? 'active' : 'inactive'}`}>
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
                    <span className="attribute-badge supervisor-badge" title={`Supervisor: ${taskCode.supervisorRequired}`}>
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
                  <Link to={`/task-codes/${taskCode.id}`} className="view-link">
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
