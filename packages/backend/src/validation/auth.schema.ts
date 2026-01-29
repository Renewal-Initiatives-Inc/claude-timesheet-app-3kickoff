import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

/**
 * Schema for employee registration (supervisor only).
 */
export const registerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name must be less than 255 characters'),
  email: z
    .string()
    .email('Invalid email address')
    .max(255, 'Email must be less than 255 characters'),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in YYYY-MM-DD format'),
  isSupervisor: z.boolean().optional(),
  tempPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

/**
 * Schema for login.
 */
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * Schema for password reset request.
 */
export const passwordResetRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
});

/**
 * Schema for password reset token validation.
 */
export const passwordResetValidateSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

/**
 * Schema for password reset completion.
 */
export const passwordResetCompleteSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

/**
 * Create validation middleware from a Zod schema.
 */
export function validate<T extends z.ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errors = result.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));

      res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid request data',
        details: errors,
      });
      return;
    }

    // Replace body with validated data
    req.body = result.data;
    next();
  };
}

// Export types
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetCompleteInput = z.infer<typeof passwordResetCompleteSchema>;
