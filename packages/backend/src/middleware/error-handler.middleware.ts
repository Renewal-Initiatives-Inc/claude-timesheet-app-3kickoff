import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { sanitizeForErrorMessage } from '../utils/sanitization.js';

/**
 * Known application error codes and their HTTP status codes.
 */
const ERROR_STATUS_MAP: Record<string, number> = {
  // Authentication errors (401)
  INVALID_CREDENTIALS: 401,
  INVALID_TOKEN: 401,
  TOKEN_EXPIRED: 401,
  SESSION_EXPIRED: 401,

  // Account locked (423)
  ACCOUNT_LOCKED: 423,

  // Forbidden errors (403)
  FORBIDDEN: 403,
  ACCESS_DENIED: 403,
  CSRF_TOKEN_MISSING: 403,
  CSRF_TOKEN_INVALID: 403,

  // Not found errors (404)
  NOT_FOUND: 404,
  EMPLOYEE_NOT_FOUND: 404,
  TIMESHEET_NOT_FOUND: 404,
  DOCUMENT_NOT_FOUND: 404,
  TASK_CODE_NOT_FOUND: 404,

  // Conflict errors (409)
  EMAIL_EXISTS: 409,
  DUPLICATE: 409,
  ALREADY_EXISTS: 409,

  // Validation errors (400)
  VALIDATION_ERROR: 400,
  INVALID_INPUT: 400,
  COMPLIANCE_FAILED: 400,
  AGE_TOO_YOUNG: 400,

  // Rate limiting (429)
  RATE_LIMITED: 429,
  TOO_MANY_REQUESTS: 429,

  // Server errors (500)
  INTERNAL_ERROR: 500,
  DATABASE_ERROR: 500,
};

/**
 * Application error class for consistent error handling.
 */
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }

  get statusCode(): number {
    return ERROR_STATUS_MAP[this.code] || 500;
  }
}

/**
 * Get HTTP status code for an error code.
 */
function getStatusCode(code: string): number {
  return ERROR_STATUS_MAP[code] || 500;
}

/**
 * Check if we're in production environment.
 */
function isProduction(): boolean {
  return process.env['NODE_ENV'] === 'production';
}

/**
 * Log error details for debugging.
 * In a real app, this would use a proper logging service.
 */
function logError(error: Error, req: Request): void {
  const errorLog = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    errorName: error.name,
    errorMessage: error.message,
    // Only include stack in non-production
    stack: isProduction() ? undefined : error.stack,
    // Include sanitized user info for context
    userId: (req as Request & { employee?: { id: string } }).employee?.id,
  };

  // Use console.error for now (will be replaced with proper logger)
  console.error('[ERROR]', JSON.stringify(errorLog, null, 2));
}

/**
 * Format Zod validation errors into a user-friendly format.
 */
function formatZodError(error: ZodError): { field: string; message: string }[] {
  return error.errors.map((e) => ({
    field: e.path.join('.'),
    message: e.message,
  }));
}

/**
 * Global error handler middleware.
 *
 * Must be registered as the LAST middleware to catch all errors.
 */
export const errorHandler: ErrorRequestHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log the error
  logError(error, req);

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Invalid input data',
      details: formatZodError(error),
    });
    return;
  }

  // Handle our custom AppError
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      error: error.code,
      message: error.message,
      ...(error.details && !isProduction() ? { details: error.details } : {}),
    });
    return;
  }

  // Handle errors with a code property (from services)
  if ('code' in error && typeof (error as { code?: string }).code === 'string') {
    const errorWithCode = error as Error & { code: string };
    const statusCode = getStatusCode(errorWithCode.code);

    res.status(statusCode).json({
      error: errorWithCode.code,
      message: error.message,
    });
    return;
  }

  // Handle SyntaxError (e.g., invalid JSON in request body)
  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({
      error: 'INVALID_JSON',
      message: 'Invalid JSON in request body',
    });
    return;
  }

  // Handle unknown errors
  // In production, don't expose error details
  if (isProduction()) {
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Please try again later.',
    });
    return;
  }

  // In development, include more details for debugging
  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: sanitizeForErrorMessage(error.message),
    stack: error.stack?.split('\n').slice(0, 5).join('\n'),
  });
};

/**
 * Async handler wrapper to catch async errors.
 * Use this to wrap async route handlers.
 */
export function asyncHandler<T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404 handler for unknown routes.
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: 'NOT_FOUND',
    message: `Route ${req.method} ${req.path} not found`,
  });
}
