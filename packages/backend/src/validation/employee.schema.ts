import { z } from 'zod';

/**
 * Schema for updating an employee.
 * Note: dateOfBirth cannot be changed after creation.
 */
export const updateEmployeeSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(255, 'Name must be less than 255 characters')
    .optional(),
  email: z
    .string()
    .email('Invalid email address')
    .max(255, 'Email must be less than 255 characters')
    .optional(),
});

/**
 * Schema for employee list query params.
 */
export const employeeListQuerySchema = z.object({
  status: z.enum(['active', 'archived', 'all']).optional().default('active'),
  search: z.string().optional(),
});

// Export types
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type EmployeeListQuery = z.infer<typeof employeeListQuerySchema>;
