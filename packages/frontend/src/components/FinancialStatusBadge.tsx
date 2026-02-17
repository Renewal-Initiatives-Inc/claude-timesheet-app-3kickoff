import { useState, useEffect } from 'react';
import { getTimesheetFinancialStatus, type FinancialStatusRecord } from '../api/client.js';

const STATUS_LABELS: Record<string, string> = {
  received: 'Received',
  posted: 'Posted',
  matched_to_payment: 'Matched',
  paid: 'Paid',
  error: 'Error',
};

const STATUS_COLORS: Record<string, string> = {
  received: '#6b7280',
  posted: '#2563eb',
  matched_to_payment: '#7c3aed',
  paid: '#16a34a',
  error: '#dc2626',
};

function getOverallStatus(records: FinancialStatusRecord[]): string {
  if (records.length === 0) return 'none';
  if (records.some((r) => r.status === 'error')) return 'error';
  if (records.every((r) => r.status === 'paid')) return 'paid';
  if (records.every((r) => r.status === 'posted' || r.status === 'matched_to_payment' || r.status === 'paid')) return 'posted';
  return 'received';
}

interface FinancialStatusBadgeProps {
  timesheetId: string;
  timesheetStatus: string;
  compact?: boolean;
}

export function FinancialStatusBadge({
  timesheetId,
  timesheetStatus,
  compact = false,
}: FinancialStatusBadgeProps) {
  const [records, setRecords] = useState<FinancialStatusRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (timesheetStatus !== 'approved') return;

    setLoading(true);
    getTimesheetFinancialStatus(timesheetId)
      .then((data) => setRecords(data.records))
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  }, [timesheetId, timesheetStatus]);

  if (timesheetStatus !== 'approved') return null;
  if (loading) return <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>...</span>;
  if (records.length === 0) return null;

  const overall = getOverallStatus(records);
  const color = STATUS_COLORS[overall] || '#6b7280';
  const label = STATUS_LABELS[overall] || overall;

  if (compact) {
    return (
      <span
        data-testid={`financial-status-badge-${timesheetId}`}
        style={{
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: '9999px',
          fontSize: '0.7rem',
          fontWeight: 600,
          color: 'white',
          backgroundColor: color,
        }}
        title={`Financial: ${records.length} fund(s) — ${label}`}
      >
        {label}
      </span>
    );
  }

  return (
    <div data-testid={`financial-status-detail-${timesheetId}`} style={{ marginTop: '0.5rem' }}>
      <strong style={{ fontSize: '0.8rem', color: '#374151' }}>Financial Status</strong>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
        {records.map((r) => (
          <span
            key={r.id}
            style={{
              display: 'inline-block',
              padding: '2px 8px',
              borderRadius: '9999px',
              fontSize: '0.7rem',
              fontWeight: 600,
              color: 'white',
              backgroundColor: STATUS_COLORS[r.status] || '#6b7280',
            }}
            title={`Fund ${r.fundId}: $${parseFloat(r.amount).toFixed(2)}`}
          >
            Fund {r.fundId}: {STATUS_LABELS[r.status] || r.status}
          </span>
        ))}
      </div>
    </div>
  );
}
