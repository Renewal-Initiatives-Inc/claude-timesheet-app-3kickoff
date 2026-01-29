import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useDashboard } from '../hooks/useEmployees.js';
import { AlertsList } from '../components/AlertsList.js';
import type { AlertType } from '@renewal/types';
import './Alerts.css';

type FilterType = 'all' | AlertType;

export function Alerts() {
  const { alerts, loading, error, refetch } = useDashboard();
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAlerts = useMemo(() => {
    let result = alerts;

    // Filter by type
    if (filterType !== 'all') {
      result = result.filter((alert) => alert.type === filterType);
    }

    // Filter by employee name
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((alert) => alert.employeeName.toLowerCase().includes(query));
    }

    return result;
  }, [alerts, filterType, searchQuery]);

  const alertCounts = useMemo(() => {
    return {
      all: alerts.length,
      missing_document: alerts.filter((a) => a.type === 'missing_document').length,
      expiring_document: alerts.filter((a) => a.type === 'expiring_document').length,
      age_transition: alerts.filter((a) => a.type === 'age_transition').length,
    };
  }, [alerts]);

  if (error) {
    return (
      <div className="alerts-page">
        <div className="alerts-error">
          <p>Error loading alerts: {error}</p>
          <button onClick={refetch} data-testid="alerts-retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="alerts-page">
      <header className="alerts-header">
        <div>
          <h1>All Alerts</h1>
          <p>Manage compliance alerts for all employees</p>
        </div>
        <Link to="/dashboard" className="alerts-back-link" data-testid="alerts-back-to-dashboard">
          Back to Dashboard
        </Link>
      </header>

      <div className="alerts-filters">
        <div className="alerts-filter-group">
          <label htmlFor="alert-type-filter">Filter by type:</label>
          <select
            id="alert-type-filter"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as FilterType)}
            data-testid="alerts-type-filter"
          >
            <option value="all">All Alerts ({alertCounts.all})</option>
            <option value="missing_document">
              Missing Documents ({alertCounts.missing_document})
            </option>
            <option value="expiring_document">
              Expiring Documents ({alertCounts.expiring_document})
            </option>
            <option value="age_transition">Age Transitions ({alertCounts.age_transition})</option>
          </select>
        </div>

        <div className="alerts-filter-group">
          <label htmlFor="alert-search">Search employee:</label>
          <input
            id="alert-search"
            type="text"
            placeholder="Search by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="alerts-search-input"
          />
        </div>

        <button
          className="alerts-refresh-btn"
          onClick={refetch}
          data-testid="alerts-refresh-button"
        >
          Refresh
        </button>
      </div>

      <div className="alerts-summary">
        <span className="alerts-count">
          Showing {filteredAlerts.length} of {alerts.length} alerts
        </span>
      </div>

      <AlertsList alerts={filteredAlerts} loading={loading} />
    </div>
  );
}
