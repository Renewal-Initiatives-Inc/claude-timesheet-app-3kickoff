import ExcelJS from 'exceljs';
import type {
  TimesheetHistoryRecord,
  TimesheetHistorySummary,
} from '../services/reports.service.js';

/**
 * Generate an XLSX workbook buffer for timesheet history export.
 * Designed for client-facing reports with professional formatting.
 */
export async function generateTimesheetHistoryXLSX(
  records: TimesheetHistoryRecord[],
  _summary: TimesheetHistorySummary,
  filters: { startDate: string; endDate: string; taskCodes?: string[] }
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Renewal Initiatives';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Timesheet History');

  // ---- Title Section ----
  sheet.mergeCells('A1:I1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'Timesheet History Report';
  titleCell.font = { size: 14, bold: true };
  titleCell.alignment = { horizontal: 'left' };

  sheet.mergeCells('A2:I2');
  const dateRangeCell = sheet.getCell('A2');
  dateRangeCell.value = `Period: ${filters.startDate} to ${filters.endDate}`;
  dateRangeCell.font = { size: 10, italic: true, color: { argb: 'FF666666' } };

  let dataStartRow = 4;
  if (filters.taskCodes && filters.taskCodes.length > 0) {
    sheet.mergeCells('A3:I3');
    const filterCell = sheet.getCell('A3');
    filterCell.value = `Task Codes: ${filters.taskCodes.join(', ')}`;
    filterCell.font = { size: 10, italic: true, color: { argb: 'FF666666' } };
    dataStartRow = 5;
  }

  // ---- Column Definitions ----
  const columns = [
    { header: 'Date', key: 'date', width: 12 },
    { header: 'Employee', key: 'employee', width: 20 },
    { header: 'Task Code', key: 'taskCode', width: 10 },
    { header: 'Task Name', key: 'taskName', width: 25 },
    { header: 'Start Time', key: 'startTime', width: 10 },
    { header: 'End Time', key: 'endTime', width: 10 },
    { header: 'Hours', key: 'hours', width: 8 },
    { header: 'Rate ($/hr)', key: 'rate', width: 12 },
    { header: 'Notes', key: 'notes', width: 30 },
  ];

  // Set column widths
  columns.forEach((col, i) => {
    sheet.getColumn(i + 1).width = col.width;
  });

  // ---- Header Row ----
  const headerRow = sheet.getRow(dataStartRow);
  columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' },
    };
    cell.alignment = {
      horizontal: col.key === 'hours' || col.key === 'rate' ? 'right' : 'left',
    };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    };
  });

  // ---- Data Rows ----
  let currentRow = dataStartRow + 1;
  let totalHours = 0;
  let totalEarnings = 0;

  for (const ts of records) {
    // Week separator row
    const weekRow = sheet.getRow(currentRow);
    sheet.mergeCells(`A${currentRow}:I${currentRow}`);
    weekRow.getCell(1).value = `${ts.employeeName} — Week of ${ts.weekStartDate} (${ts.status})`;
    weekRow.getCell(1).font = { bold: true, size: 10 };
    weekRow.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF3F4F6' },
    };
    currentRow++;

    for (const entry of ts.entries) {
      const row = sheet.getRow(currentRow);
      const hours = parseFloat(entry.hours);
      const rate = entry.rate ? parseFloat(entry.rate) : 0;
      const earnings = hours * rate;

      row.getCell(1).value = entry.workDate;
      row.getCell(2).value = ts.employeeName;
      row.getCell(3).value = entry.taskCode;
      row.getCell(4).value = entry.taskName;
      row.getCell(5).value = entry.startTime;
      row.getCell(6).value = entry.endTime;
      row.getCell(7).value = hours;
      row.getCell(7).numFmt = '0.00';
      row.getCell(7).alignment = { horizontal: 'right' };
      row.getCell(8).value = rate;
      row.getCell(8).numFmt = '$#,##0.00';
      row.getCell(8).alignment = { horizontal: 'right' };
      row.getCell(9).value = entry.notes || '';

      // Alternate row shading
      if ((currentRow - dataStartRow) % 2 === 0) {
        for (let c = 1; c <= 9; c++) {
          row.getCell(c).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFAFAFA' },
          };
        }
      }

      totalHours += hours;
      totalEarnings += earnings;
      currentRow++;
    }
  }

  // ---- Summary / Totals Row ----
  currentRow++; // blank row
  const summaryRow = sheet.getRow(currentRow);
  summaryRow.getCell(6).value = 'TOTALS:';
  summaryRow.getCell(6).font = { bold: true };
  summaryRow.getCell(6).alignment = { horizontal: 'right' };
  summaryRow.getCell(7).value = totalHours;
  summaryRow.getCell(7).numFmt = '0.00';
  summaryRow.getCell(7).font = { bold: true };
  summaryRow.getCell(7).alignment = { horizontal: 'right' };
  summaryRow.getCell(8).value = totalEarnings;
  summaryRow.getCell(8).numFmt = '$#,##0.00';
  summaryRow.getCell(8).font = { bold: true };
  summaryRow.getCell(8).alignment = { horizontal: 'right' };

  // Top border for totals row
  for (let c = 6; c <= 8; c++) {
    summaryRow.getCell(c).border = {
      top: { style: 'double', color: { argb: 'FF000000' } },
    };
  }

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Generate filename for XLSX export.
 */
export function generateTimesheetHistoryFilename(
  startDate: string,
  endDate: string
): string {
  return `timesheet-history-${startDate}-to-${endDate}.xlsx`;
}
