import { z } from 'zod';

/**
 * Age band values for filtering reports.
 */
export const ageBandEnum = z.enum(['12-13', '14-15', '16-17', '18+']);

/**
 * Compliance result values for filtering.
 */
export const complianceResultFilterEnum = z.enum(['pass', 'fail', 'not_applicable']);

/**
 * Schema for compliance audit report query parameters.
 */
export const complianceAuditQuerySchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  employeeId: z.string().uuid('Invalid employee ID').optional(),
  ageBand: ageBandEnum.optional(),
  result: complianceResultFilterEnum.optional(),
  ruleId: z.string().max(20).optional(),
});

/**
 * Schema for compliance audit export request body.
 */
export const complianceAuditExportSchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  employeeId: z.string().uuid('Invalid employee ID').optional(),
  ageBand: ageBandEnum.optional(),
  result: complianceResultFilterEnum.optional(),
  ruleId: z.string().max(20).optional(),
});

/**
 * Schema for timesheet history report query parameters.
 */
export const timesheetHistoryQuerySchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  employeeId: z.string().uuid('Invalid employee ID').optional(),
  status: z.enum(['open', 'submitted', 'approved', 'rejected']).optional(),
  ageBand: ageBandEnum.optional(),
});

// Export types
export type ComplianceAuditQueryInput = z.infer<typeof complianceAuditQuerySchema>;
export type ComplianceAuditExportInput = z.infer<typeof complianceAuditExportSchema>;
export type TimesheetHistoryQueryInput = z.infer<typeof timesheetHistoryQuerySchema>;
export type AgeBand = z.infer<typeof ageBandEnum>;
export type ComplianceResultFilter = z.infer<typeof complianceResultFilterEnum>;
