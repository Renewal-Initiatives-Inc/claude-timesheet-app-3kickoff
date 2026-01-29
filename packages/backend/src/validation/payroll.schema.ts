import { z } from 'zod';

/**
 * Age band values for filtering reports.
 */
export const ageBandEnum = z.enum(['12-13', '14-15', '16-17', '18+']);

/**
 * Schema for payroll report query parameters.
 */
export const payrollReportQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  employeeId: z.string().uuid('Invalid employee ID').optional(),
  ageBand: ageBandEnum.optional(),
});

/**
 * Schema for payroll export request body.
 */
export const payrollExportSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  employeeId: z.string().uuid('Invalid employee ID').optional(),
  ageBand: ageBandEnum.optional(),
});

/**
 * Schema for timesheet ID path parameter.
 */
export const timesheetIdParamSchema = z.object({
  timesheetId: z.string().uuid('Invalid timesheet ID'),
});

// Export types
export type PayrollReportQueryInput = z.infer<typeof payrollReportQuerySchema>;
export type PayrollExportInput = z.infer<typeof payrollExportSchema>;
export type TimesheetIdParamInput = z.infer<typeof timesheetIdParamSchema>;
