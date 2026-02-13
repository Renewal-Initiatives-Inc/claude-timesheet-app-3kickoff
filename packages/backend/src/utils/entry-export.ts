/**
 * CSV export utility for timesheet entries.
 * Follows the same pattern as payroll-export.ts.
 */

/**
 * CSV column headers for entry export.
 */
const CSV_HEADERS = [
  'Date',
  'Task Code',
  'Task Name',
  'Start Time',
  'End Time',
  'Hours',
  'Rate',
  'Earnings',
  'Notes',
];

/**
 * A row of entry data for CSV export.
 */
export interface EntryExportRow {
  workDate: string;
  taskCode: string;
  taskName: string;
  startTime: string;
  endTime: string;
  hours: string;
  rate: string;
  earnings: string;
  notes: string | null;
}

/**
 * Escape a value for CSV format.
 * Wraps values containing commas, quotes, or newlines in double quotes.
 * Escapes embedded double quotes by doubling them.
 */
function escapeCSVValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Generate a CSV string from entry export rows.
 */
export function generateEntryCSV(rows: EntryExportRow[]): string {
  const lines: string[] = [];

  // Add header row
  lines.push(CSV_HEADERS.map(escapeCSVValue).join(','));

  // Add data rows
  for (const row of rows) {
    const values = [
      row.workDate,
      row.taskCode,
      row.taskName,
      row.startTime,
      row.endTime,
      parseFloat(row.hours).toFixed(2),
      row.rate,
      row.earnings,
      row.notes || '',
    ];

    lines.push(values.map((val) => escapeCSVValue(String(val))).join(','));
  }

  return lines.join('\r\n');
}

/**
 * Generate a filename for entry CSV export.
 */
export function generateEntryFilename(weekStartDate: string): string {
  const weekDate = weekStartDate.replace(/-/g, '');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `timesheet-entries-${weekDate}-${timestamp}.csv`;
}
