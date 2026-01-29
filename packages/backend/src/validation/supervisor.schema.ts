import { z } from 'zod';

/**
 * Validate that a date string is a Sunday (week start).
 */
function isValidSunday(dateStr: string): boolean {
  const date = new Date(dateStr + 'T00:00:00');
  return date.getDay() === 0;
}

/**
 * Schema for approving a timesheet.
 */
export const approveTimesheetSchema = z.object({
  notes: z.string().max(2000, 'Notes must be less than 2000 characters').optional(),
});

/**
 * Schema for rejecting a timesheet.
 */
export const rejectTimesheetSchema = z.object({
  notes: z
    .string()
    .min(10, 'Notes must be at least 10 characters')
    .max(2000, 'Notes must be less than 2000 characters'),
});

/**
 * Schema for unlocking a week.
 */
export const unlockWeekSchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID'),
  weekStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')
    .refine(isValidSunday, 'Week start date must be a Sunday'),
});

/**
 * Schema for review queue query parameters.
 */
export const reviewQueueQuerySchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID').optional(),
});

// Export types
export type ApproveTimesheetInput = z.infer<typeof approveTimesheetSchema>;
export type RejectTimesheetInput = z.infer<typeof rejectTimesheetSchema>;
export type UnlockWeekInput = z.infer<typeof unlockWeekSchema>;
export type ReviewQueueQueryInput = z.infer<typeof reviewQueueQuerySchema>;
