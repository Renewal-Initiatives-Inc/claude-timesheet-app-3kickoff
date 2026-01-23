import { z } from 'zod';

/**
 * Schema for creating a new task code.
 */
export const createTaskCodeSchema = z.object({
  code: z
    .string()
    .min(1, 'Code is required')
    .max(10, 'Code must be 10 characters or less')
    .regex(/^[A-Z0-9-]+$/i, 'Code must contain only letters, numbers, and hyphens'),
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less'),
  description: z
    .string()
    .max(500, 'Description must be 500 characters or less')
    .optional(),
  isAgricultural: z.boolean(),
  isHazardous: z.boolean(),
  supervisorRequired: z.enum(['none', 'for_minors', 'always']),
  minAgeAllowed: z
    .number()
    .int('Minimum age must be a whole number')
    .min(12, 'Minimum age allowed must be at least 12')
    .max(18, 'Minimum age allowed cannot exceed 18'),
  soloCashHandling: z.boolean(),
  drivingRequired: z.boolean(),
  powerMachinery: z.boolean(),
  // Initial rate (required on creation)
  initialRate: z
    .number()
    .positive('Initial rate must be a positive number'),
  rateEffectiveDate: z
    .string()
    .min(1, 'Rate effective date is required'),
  rateJustificationNotes: z
    .string()
    .max(500, 'Justification notes must be 500 characters or less')
    .optional(),
});

/**
 * Schema for updating a task code.
 * Note: code field is NOT updateable.
 */
export const updateTaskCodeSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less')
    .optional(),
  description: z
    .string()
    .max(500, 'Description must be 500 characters or less')
    .optional(),
  isAgricultural: z.boolean().optional(),
  isHazardous: z.boolean().optional(),
  supervisorRequired: z.enum(['none', 'for_minors', 'always']).optional(),
  minAgeAllowed: z
    .number()
    .int('Minimum age must be a whole number')
    .min(12, 'Minimum age allowed must be at least 12')
    .max(18, 'Minimum age allowed cannot exceed 18')
    .optional(),
  soloCashHandling: z.boolean().optional(),
  drivingRequired: z.boolean().optional(),
  powerMachinery: z.boolean().optional(),
  isActive: z.boolean().optional(), // For soft archive
});

/**
 * Schema for adding a new rate to a task code.
 */
export const addRateSchema = z.object({
  hourlyRate: z
    .number()
    .positive('Hourly rate must be a positive number'),
  effectiveDate: z
    .string()
    .min(1, 'Effective date is required'),
  justificationNotes: z
    .string()
    .max(500, 'Justification notes must be 500 characters or less')
    .optional(),
});

/**
 * Schema for task code list query parameters.
 */
export const taskCodeListQuerySchema = z.object({
  isAgricultural: z.enum(['true', 'false']).optional(),
  isHazardous: z.enum(['true', 'false']).optional(),
  forAge: z.coerce.number().int().min(12).optional(),
  includeInactive: z.enum(['true', 'false']).optional(),
  search: z.string().optional(),
});

// Export types
export type CreateTaskCodeInput = z.infer<typeof createTaskCodeSchema>;
export type UpdateTaskCodeInput = z.infer<typeof updateTaskCodeSchema>;
export type AddRateInput = z.infer<typeof addRateSchema>;
export type TaskCodeListQuery = z.infer<typeof taskCodeListQuerySchema>;
