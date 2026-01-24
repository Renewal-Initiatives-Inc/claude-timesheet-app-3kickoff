import type { PayrollRecordWithDetails } from '../services/payroll.service.js';

/**
 * CSV column headers for payroll export.
 */
const CSV_HEADERS = [
  'Employee Name',
  'Employee ID',
  'Pay Period Start',
  'Pay Period End',
  'Agricultural Hours',
  'Agricultural Earnings',
  'Non-Agricultural Hours',
  'Non-Agricultural Earnings',
  'Overtime Hours',
  'Overtime Earnings',
  'Total Earnings',
  'Calculated At',
];

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
 * Format a date string to MM/DD/YYYY format for CSV export.
 */
function formatDateForExport(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

/**
 * Format a decimal string to 2 decimal places.
 */
function formatDecimal(value: string): string {
  return parseFloat(value).toFixed(2);
}

/**
 * Generate a CSV string from payroll records.
 *
 * CSV Columns:
 * - Employee Name: Full name
 * - Employee ID: Database ID (for reference)
 * - Pay Period Start: MM/DD/YYYY format
 * - Pay Period End: MM/DD/YYYY format
 * - Agricultural Hours: Decimal, 2 places
 * - Agricultural Earnings: Decimal, 2 places
 * - Non-Agricultural Hours: Decimal, 2 places
 * - Non-Agricultural Earnings: Decimal, 2 places
 * - Overtime Hours: Decimal, 2 places
 * - Overtime Earnings: Decimal, 2 places
 * - Total Earnings: Decimal, 2 places
 * - Calculated At: ISO timestamp
 */
export function generatePayrollCSV(records: PayrollRecordWithDetails[]): string {
  const lines: string[] = [];

  // Add header row
  lines.push(CSV_HEADERS.map(escapeCSVValue).join(','));

  // Add data rows
  for (const record of records) {
    const row = [
      record.employee.name,
      record.employeeId,
      formatDateForExport(record.periodStart),
      formatDateForExport(record.periodEnd),
      formatDecimal(record.agriculturalHours),
      formatDecimal(record.agriculturalEarnings),
      formatDecimal(record.nonAgriculturalHours),
      formatDecimal(record.nonAgriculturalEarnings),
      formatDecimal(record.overtimeHours),
      formatDecimal(record.overtimeEarnings),
      formatDecimal(record.totalEarnings),
      record.calculatedAt,
    ];

    lines.push(row.map((val) => escapeCSVValue(String(val))).join(','));
  }

  return lines.join('\r\n');
}

/**
 * Generate a filename for payroll CSV export.
 */
export function generatePayrollFilename(startDate: string, endDate: string): string {
  const start = startDate.replace(/-/g, '');
  const end = endDate.replace(/-/g, '');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `payroll-export-${start}-to-${end}-${timestamp}.csv`;
}
