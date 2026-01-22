import { z } from 'zod';

/**
 * Schema for document upload metadata.
 * File is handled by multer, this validates the form fields.
 */
export const documentUploadSchema = z.object({
  type: z.enum(['parental_consent', 'work_permit', 'safety_training'], {
    errorMap: () => ({
      message: 'Type must be one of: parental_consent, work_permit, safety_training',
    }),
  }),
  expiresAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expiration date must be in YYYY-MM-DD format')
    .optional(),
});

/**
 * Schema for marking safety training complete.
 */
export const safetyTrainingSchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID'),
});

// Export types
export type DocumentUploadInput = z.infer<typeof documentUploadSchema>;
export type SafetyTrainingInput = z.infer<typeof safetyTrainingSchema>;
