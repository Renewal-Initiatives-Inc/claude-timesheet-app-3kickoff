import { z } from 'zod';

/**
 * Validate that a date string is a Sunday (week start).
 */
function isValidSunday(dateStr: string): boolean {
  const date = new Date(dateStr + 'T00:00:00');
  return date.getDay() === 0;
}

/**
 * Schema for getting/creating a timesheet for a specific week.
 */
export const getTimesheetSchema = z.object({
  weekStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')
    .refine(isValidSunday, 'Week start date must be a Sunday'),
});

/**
 * Schema for creating a timesheet entry.
 */
export const createEntrySchema = z.object({
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  taskCodeId: z.string().uuid('Invalid task code ID'),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
  isSchoolDay: z.boolean(),
  schoolDayOverrideNote: z
    .string()
    .min(10, 'Override note must be at least 10 characters')
    .max(500, 'Override note must be less than 500 characters')
    .optional()
    .nullable(),
  supervisorPresentName: z
    .string()
    .min(2, 'Supervisor name must be at least 2 characters')
    .max(100, 'Supervisor name must be less than 100 characters')
    .optional()
    .nullable(),
  mealBreakConfirmed: z.boolean().optional().nullable(),
});

/**
 * Schema for updating a timesheet entry.
 */
export const updateEntrySchema = z.object({
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)')
    .optional(),
  endTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)')
    .optional(),
  taskCodeId: z.string().uuid('Invalid task code ID').optional(),
  isSchoolDay: z.boolean().optional(),
  schoolDayOverrideNote: z
    .string()
    .min(10, 'Override note must be at least 10 characters')
    .max(500, 'Override note must be less than 500 characters')
    .optional()
    .nullable(),
  supervisorPresentName: z
    .string()
    .min(2, 'Supervisor name must be at least 2 characters')
    .max(100, 'Supervisor name must be less than 100 characters')
    .optional()
    .nullable(),
  mealBreakConfirmed: z.boolean().optional().nullable(),
});

/**
 * Schema for listing timesheets query parameters.
 */
export const listTimesheetsQuerySchema = z.object({
  status: z.enum(['open', 'submitted', 'approved', 'rejected', 'all']).optional(),
  limit: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive().max(100))
    .optional(),
  offset: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().nonnegative())
    .optional(),
});

// Export types
export type GetTimesheetInput = z.infer<typeof getTimesheetSchema>;
export type CreateEntryInput = z.infer<typeof createEntrySchema>;
export type UpdateEntryInput = z.infer<typeof updateEntrySchema>;
export type ListTimesheetsQueryInput = z.infer<typeof listTimesheetsQuerySchema>;
