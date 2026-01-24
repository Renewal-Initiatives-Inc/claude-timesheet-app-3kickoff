import type { ComplianceAuditRecord } from '../services/reports.service.js';

/**
 * Generate CSV content for compliance audit records.
 */
export function generateComplianceAuditCSV(records: ComplianceAuditRecord[]): string {
  const headers = [
    'Timestamp',
    'Employee Name',
    'Employee ID',
    'Age On Date',
    'Age Band',
    'Rule ID',
    'Rule Description',
    'Result',
    'Details',
    'Timesheet Week Start',
  ];

  const rows = records.map((record) => [
    formatTimestamp(record.checkedAt),
    escapeCSV(record.employeeName),
    record.employeeId,
    record.employeeAgeOnDate.toString(),
    record.ageBand,
    record.ruleId,
    escapeCSV(record.details.ruleDescription || ''),
    record.result,
    escapeCSV(JSON.stringify(record.details)),
    record.weekStartDate,
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\n');

  return csvContent;
}

/**
 * Format ISO timestamp for CSV.
 */
function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toISOString().replace('T', ' ').replace('Z', '');
}

/**
 * Escape a value for CSV (handle quotes and commas).
 */
function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Generate filename for compliance audit export.
 */
export function generateComplianceAuditFilename(startDate: string, endDate: string): string {
  return `compliance-audit-${startDate}-to-${endDate}.csv`;
}
