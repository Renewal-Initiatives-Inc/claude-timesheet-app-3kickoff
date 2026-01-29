import pino from 'pino';
import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';

/**
 * Structured logging utility using pino.
 *
 * Features:
 * - JSON output in production for easy parsing
 * - Pretty output in development for readability
 * - Request ID tracking
 * - Sensitive data scrubbing
 * - Context-rich log entries
 */

// List of sensitive fields to redact from logs
const SENSITIVE_FIELDS = [
  'password',
  'newPassword',
  'currentPassword',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'apiKey',
  'authorization',
  'cookie',
  'ssn',
  'creditCard',
];

/**
 * Create a pino logger instance with appropriate configuration.
 */
function createLogger() {
  const isProduction = process.env['NODE_ENV'] === 'production';
  const isTest = process.env['NODE_ENV'] === 'test';

  // In test mode, use minimal logging to reduce noise
  if (isTest) {
    return pino({
      level: 'silent', // Disable logs in tests
    });
  }

  return pino({
    level: process.env['LOG_LEVEL'] || (isProduction ? 'info' : 'debug'),

    // Redact sensitive fields
    redact: {
      paths: SENSITIVE_FIELDS.flatMap((field) => [
        field,
        `*.${field}`,
        `body.${field}`,
        `req.body.${field}`,
        `headers.${field}`,
      ]),
      censor: '[REDACTED]',
    },

    // Timestamp configuration
    timestamp: pino.stdTimeFunctions.isoTime,

    // Base properties included in every log
    base: {
      env: process.env['NODE_ENV'],
      service: 'renewal-timesheet',
    },

    // Format output based on environment
    ...(isProduction
      ? {}
      : {
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            },
          },
        }),
  });
}

// Export singleton logger instance
export const logger = createLogger();

/**
 * Create a child logger with additional context.
 * Useful for adding request-specific context.
 */
export function createContextLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

/**
 * Scrub sensitive data from an object for logging.
 * This is a manual alternative when redaction isn't enough.
 */
export function scrubSensitiveData<T extends Record<string, unknown>>(obj: T): T {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  // Handle arrays specially to preserve array type
  if (Array.isArray(obj)) {
    return obj.map((item) =>
      typeof item === 'object' && item !== null
        ? scrubSensitiveData(item as Record<string, unknown>)
        : item
    ) as unknown as T;
  }

  const scrubbed = { ...obj };

  for (const key of Object.keys(scrubbed)) {
    const lowerKey = key.toLowerCase();

    // Check if key matches any sensitive field pattern
    if (SENSITIVE_FIELDS.some((field) => lowerKey.includes(field.toLowerCase()))) {
      (scrubbed as Record<string, unknown>)[key] = '[REDACTED]';
    } else if (typeof scrubbed[key] === 'object' && scrubbed[key] !== null) {
      (scrubbed as Record<string, unknown>)[key] = scrubSensitiveData(
        scrubbed[key] as Record<string, unknown>
      );
    }
  }

  return scrubbed;
}

/**
 * Format error for logging.
 * Includes stack trace in development, omits in production.
 */
export function formatError(error: Error): Record<string, unknown> {
  const isProduction = process.env['NODE_ENV'] === 'production';

  return {
    name: error.name,
    message: error.message,
    ...(isProduction ? {} : { stack: error.stack }),
    ...('code' in error && typeof error.code === 'string' ? { code: error.code } : {}),
  };
}

// Extend Express Request type to include requestId
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId?: string;
      log?: pino.Logger;
    }
  }
}

/**
 * Express middleware to add request logging.
 * Adds requestId to each request for tracing.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  // Skip logging in test environment
  if (process.env['NODE_ENV'] === 'test') {
    return next();
  }

  // Generate unique request ID
  const requestId = req.headers['x-request-id']?.toString() || randomUUID();
  req.requestId = requestId;

  // Create request-specific logger
  req.log = logger.child({
    requestId,
    method: req.method,
    url: req.url,
  });

  // Log request start
  req.log.info({
    type: 'request',
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  // Capture response details
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;

    const logLevel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    req.log?.[logLevel]({
      type: 'response',
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    });
  });

  // Add request ID to response headers
  res.setHeader('X-Request-ID', requestId);

  next();
}

// Convenience methods for common logging patterns
export const log = {
  info: (message: string, data?: Record<string, unknown>) => logger.info(data, message),

  warn: (message: string, data?: Record<string, unknown>) => logger.warn(data, message),

  error: (message: string, error?: Error, data?: Record<string, unknown>) =>
    logger.error({ ...data, error: error ? formatError(error) : undefined }, message),

  debug: (message: string, data?: Record<string, unknown>) => logger.debug(data, message),

  /**
   * Log an audit event (important action taken by a user).
   */
  audit: (action: string, userId: string | undefined, data?: Record<string, unknown>) =>
    logger.info(
      {
        type: 'audit',
        action,
        userId,
        ...data,
      },
      `Audit: ${action}`
    ),

  /**
   * Log a security-related event.
   */
  security: (event: string, data?: Record<string, unknown>) =>
    logger.warn(
      {
        type: 'security',
        event,
        ...data,
      },
      `Security: ${event}`
    ),
};
