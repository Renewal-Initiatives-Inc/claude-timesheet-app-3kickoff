import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express, { Request, Response } from 'express';
import request from 'supertest';
import { ZodError, z } from 'zod';
import {
  errorHandler,
  AppError,
  asyncHandler,
  notFoundHandler,
} from '../../middleware/error-handler.middleware.js';

describe('Error Handler Middleware', () => {
  const originalEnv = process.env.NODE_ENV;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Suppress console.error output during tests
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    consoleSpy.mockRestore();
  });

  describe('AppError', () => {
    it('should create error with correct code and message', () => {
      const error = new AppError('INVALID_CREDENTIALS', 'Wrong password');
      expect(error.code).toBe('INVALID_CREDENTIALS');
      expect(error.message).toBe('Wrong password');
      expect(error.name).toBe('AppError');
    });

    it('should return correct status code for known errors', () => {
      expect(new AppError('INVALID_CREDENTIALS', '').statusCode).toBe(401);
      expect(new AppError('FORBIDDEN', '').statusCode).toBe(403);
      expect(new AppError('NOT_FOUND', '').statusCode).toBe(404);
      expect(new AppError('EMAIL_EXISTS', '').statusCode).toBe(409);
      expect(new AppError('VALIDATION_ERROR', '').statusCode).toBe(400);
      expect(new AppError('RATE_LIMITED', '').statusCode).toBe(429);
      expect(new AppError('INTERNAL_ERROR', '').statusCode).toBe(500);
    });

    it('should return 500 for unknown error codes', () => {
      expect(new AppError('UNKNOWN_ERROR', '').statusCode).toBe(500);
    });

    it('should include details if provided', () => {
      const error = new AppError('VALIDATION_ERROR', 'Invalid', { field: 'email' });
      expect(error.details).toEqual({ field: 'email' });
    });
  });

  describe('errorHandler', () => {
    function createTestApp(errorToThrow: Error | (() => never)) {
      const app = express();
      app.get('/test', (req, res, next) => {
        if (typeof errorToThrow === 'function') {
          errorToThrow();
        } else {
          next(errorToThrow);
        }
      });
      app.use(errorHandler);
      return app;
    }

    describe('AppError handling', () => {
      it('should handle AppError with correct status and response', async () => {
        const error = new AppError('INVALID_CREDENTIALS', 'Wrong password');
        const app = createTestApp(error);

        const response = await request(app).get('/test');

        expect(response.status).toBe(401);
        expect(response.body).toEqual({
          error: 'INVALID_CREDENTIALS',
          message: 'Wrong password',
        });
      });

      it('should include details in non-production', async () => {
        process.env.NODE_ENV = 'development';
        const error = new AppError('VALIDATION_ERROR', 'Invalid', { field: 'email' });
        const app = createTestApp(error);

        const response = await request(app).get('/test');

        expect(response.status).toBe(400);
        expect(response.body.details).toEqual({ field: 'email' });
      });

      it('should hide details in production', async () => {
        process.env.NODE_ENV = 'production';
        const error = new AppError('VALIDATION_ERROR', 'Invalid', { field: 'email' });
        const app = createTestApp(error);

        const response = await request(app).get('/test');

        expect(response.status).toBe(400);
        expect(response.body.details).toBeUndefined();
      });
    });

    describe('ZodError handling', () => {
      it('should format Zod validation errors', async () => {
        const schema = z.object({
          email: z.string().email(),
          age: z.number().min(12),
        });

        try {
          schema.parse({ email: 'invalid', age: 10 });
        } catch (e) {
          const app = createTestApp(e as ZodError);
          const response = await request(app).get('/test');

          expect(response.status).toBe(400);
          expect(response.body.error).toBe('VALIDATION_ERROR');
          expect(response.body.message).toBe('Invalid input data');
          expect(response.body.details).toBeInstanceOf(Array);
          expect(response.body.details.length).toBe(2);
        }
      });
    });

    describe('Error with code property', () => {
      it('should handle errors with a code property', async () => {
        const error = Object.assign(new Error('Not found'), {
          code: 'EMPLOYEE_NOT_FOUND',
        });
        const app = createTestApp(error);

        const response = await request(app).get('/test');

        expect(response.status).toBe(404);
        expect(response.body).toEqual({
          error: 'EMPLOYEE_NOT_FOUND',
          message: 'Not found',
        });
      });
    });

    describe('SyntaxError handling', () => {
      it('should handle JSON parse errors', async () => {
        const app = express();
        app.use(express.json());
        app.post('/test', (req, res) => res.json({ ok: true }));
        app.use(errorHandler);

        const response = await request(app)
          .post('/test')
          .set('Content-Type', 'application/json')
          .send('{ invalid json }');

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('INVALID_JSON');
      });
    });

    describe('Unknown error handling', () => {
      it('should return generic error in production', async () => {
        process.env.NODE_ENV = 'production';
        const error = new Error('Database connection failed');
        const app = createTestApp(error);

        const response = await request(app).get('/test');

        expect(response.status).toBe(500);
        expect(response.body).toEqual({
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred. Please try again later.',
        });
        // Should NOT include stack trace
        expect(response.body.stack).toBeUndefined();
      });

      it('should include details in development', async () => {
        process.env.NODE_ENV = 'development';
        const error = new Error('Database connection failed');
        const app = createTestApp(error);

        const response = await request(app).get('/test');

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('INTERNAL_ERROR');
        expect(response.body.message).toBe('Database connection failed');
        // Should include partial stack trace
        expect(response.body.stack).toBeDefined();
      });
    });

    describe('Error logging', () => {
      it('should log errors', async () => {
        const error = new AppError('TEST_ERROR', 'Test message');
        const app = createTestApp(error);

        await request(app).get('/test');

        expect(consoleSpy).toHaveBeenCalled();
        const logCall = consoleSpy.mock.calls[0];
        expect(logCall[0]).toBe('[ERROR]');
      });
    });

    describe('Error sanitization', () => {
      it('should sanitize error messages in development', async () => {
        process.env.NODE_ENV = 'development';
        const error = new Error('<script>alert("xss")</script>');
        const app = createTestApp(error);

        const response = await request(app).get('/test');

        expect(response.body.message).not.toContain('<script>');
        expect(response.body.message).toContain('&lt;script&gt;');
      });
    });
  });

  describe('asyncHandler', () => {
    it('should pass async errors to error handler', async () => {
      const app = express();
      app.get(
        '/async',
        asyncHandler(async (_req: Request, _res: Response) => {
          throw new AppError('ASYNC_ERROR', 'Async error occurred');
        })
      );
      app.use(errorHandler);

      const response = await request(app).get('/async');

      expect(response.status).toBe(500); // Unknown error code defaults to 500
      expect(response.body.error).toBe('ASYNC_ERROR');
    });

    it('should work with successful async handlers', async () => {
      const app = express();
      app.get(
        '/async',
        asyncHandler(async (req: Request, res: Response) => {
          res.json({ success: true });
        })
      );

      const response = await request(app).get('/async');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
    });
  });

  describe('notFoundHandler', () => {
    it('should return 404 for unknown routes', async () => {
      const app = express();
      app.get('/known', (req, res) => res.json({ ok: true }));
      app.use(notFoundHandler);

      const response = await request(app).get('/unknown');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('NOT_FOUND');
      expect(response.body.message).toContain('/unknown');
    });

    it('should include method in error message', async () => {
      const app = express();
      app.use(notFoundHandler);

      const response = await request(app).post('/test');

      expect(response.body.message).toContain('POST');
    });
  });

  describe('Error status code mapping', () => {
    const testCases = [
      { code: 'INVALID_CREDENTIALS', expectedStatus: 401 },
      { code: 'INVALID_TOKEN', expectedStatus: 401 },
      { code: 'TOKEN_EXPIRED', expectedStatus: 401 },
      { code: 'ACCOUNT_LOCKED', expectedStatus: 423 },
      { code: 'FORBIDDEN', expectedStatus: 403 },
      { code: 'ACCESS_DENIED', expectedStatus: 403 },
      { code: 'NOT_FOUND', expectedStatus: 404 },
      { code: 'EMPLOYEE_NOT_FOUND', expectedStatus: 404 },
      { code: 'EMAIL_EXISTS', expectedStatus: 409 },
      { code: 'VALIDATION_ERROR', expectedStatus: 400 },
      { code: 'COMPLIANCE_FAILED', expectedStatus: 400 },
      { code: 'RATE_LIMITED', expectedStatus: 429 },
      { code: 'INTERNAL_ERROR', expectedStatus: 500 },
    ];

    testCases.forEach(({ code, expectedStatus }) => {
      it(`should return ${expectedStatus} for ${code}`, async () => {
        const error = new AppError(code, 'Test message');
        const app = express();
        app.get('/test', (req, res, next) => next(error));
        app.use(errorHandler);

        const response = await request(app).get('/test');

        expect(response.status).toBe(expectedStatus);
      });
    });
  });
});
