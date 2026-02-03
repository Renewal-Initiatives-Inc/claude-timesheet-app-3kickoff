import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

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
