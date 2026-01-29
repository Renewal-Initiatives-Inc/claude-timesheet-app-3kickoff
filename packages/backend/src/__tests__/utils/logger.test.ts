import { describe, it, expect, afterEach } from 'vitest';
import { scrubSensitiveData, formatError } from '../../utils/logger.js';

describe('Logger Utilities', () => {
  describe('scrubSensitiveData', () => {
    it('should redact password fields', () => {
      const data = {
        email: 'test@example.com',
        password: 'secret123',
      };

      const scrubbed = scrubSensitiveData(data);

      expect(scrubbed.email).toBe('test@example.com');
      expect(scrubbed.password).toBe('[REDACTED]');
    });

    it('should redact nested password fields', () => {
      const data = {
        user: {
          email: 'test@example.com',
          password: 'secret123',
        },
      };

      const scrubbed = scrubSensitiveData(data);

      expect((scrubbed.user as { email: string; password: string }).email).toBe('test@example.com');
      expect((scrubbed.user as { email: string; password: string }).password).toBe('[REDACTED]');
    });

    it('should redact token fields', () => {
      const data = {
        accessToken: 'jwt-token-here',
        refreshToken: 'refresh-token-here',
        data: 'normal-data',
      };

      const scrubbed = scrubSensitiveData(data);

      expect(scrubbed.accessToken).toBe('[REDACTED]');
      expect(scrubbed.refreshToken).toBe('[REDACTED]');
      expect(scrubbed.data).toBe('normal-data');
    });

    it('should redact secret fields', () => {
      const data = {
        apiKey: 'sk_live_12345',
        secret: 'my-secret',
        publicKey: 'pk_live_12345',
      };

      const scrubbed = scrubSensitiveData(data);

      expect(scrubbed.apiKey).toBe('[REDACTED]');
      expect(scrubbed.secret).toBe('[REDACTED]');
      expect(scrubbed.publicKey).toBe('pk_live_12345'); // Not in sensitive list
    });

    it('should redact authorization headers', () => {
      const data = {
        headers: {
          authorization: 'Bearer jwt-token',
          contentType: 'application/json',
        },
      };

      const scrubbed = scrubSensitiveData(data);

      expect((scrubbed.headers as Record<string, string>).authorization).toBe('[REDACTED]');
      expect((scrubbed.headers as Record<string, string>).contentType).toBe('application/json');
    });

    it('should handle case-insensitive matching', () => {
      const data = {
        PASSWORD: 'secret1',
        Password: 'secret2',
        pAsSwOrD: 'secret3',
      };

      const scrubbed = scrubSensitiveData(data);

      expect(scrubbed.PASSWORD).toBe('[REDACTED]');
      expect(scrubbed.Password).toBe('[REDACTED]');
      expect(scrubbed.pAsSwOrD).toBe('[REDACTED]');
    });

    it('should handle null and undefined', () => {
      expect(scrubSensitiveData(null as unknown as Record<string, unknown>)).toBe(null);
      expect(scrubSensitiveData(undefined as unknown as Record<string, unknown>)).toBe(undefined);
    });

    it('should preserve arrays while scrubbing nested objects', () => {
      const data = {
        items: ['string1', 'string2'],
        mixed: [{ email: 'user@test.com', password: 'pass1' }, 'plain string'],
      };

      const scrubbed = scrubSensitiveData(data);

      // Arrays are preserved
      expect(Array.isArray(scrubbed.items)).toBe(true);
      expect(scrubbed.items).toEqual(['string1', 'string2']);
      // Mixed arrays with objects are handled
      expect(Array.isArray(scrubbed.mixed)).toBe(true);
    });

    it('should not modify the original object', () => {
      const original = {
        email: 'test@example.com',
        password: 'secret123',
      };

      scrubSensitiveData(original);

      expect(original.password).toBe('secret123'); // Original unchanged
    });

    it('should redact cookie field', () => {
      const data = {
        cookie: 'session=abc123',
        data: 'normal',
      };

      const scrubbed = scrubSensitiveData(data);

      expect(scrubbed.cookie).toBe('[REDACTED]');
    });

    it('should redact SSN and credit card fields', () => {
      const data = {
        ssn: '123-45-6789',
        creditCard: '4111111111111111',
        name: 'John Doe',
      };

      const scrubbed = scrubSensitiveData(data);

      expect(scrubbed.ssn).toBe('[REDACTED]');
      expect(scrubbed.creditCard).toBe('[REDACTED]');
      expect(scrubbed.name).toBe('John Doe');
    });
  });

  describe('formatError', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('should format error with name and message', () => {
      const error = new Error('Something went wrong');

      const formatted = formatError(error);

      expect(formatted.name).toBe('Error');
      expect(formatted.message).toBe('Something went wrong');
    });

    it('should include stack trace in development', () => {
      process.env.NODE_ENV = 'development';
      const error = new Error('Test error');

      const formatted = formatError(error);

      expect(formatted.stack).toBeDefined();
      expect(formatted.stack).toContain('Error: Test error');
    });

    it('should omit stack trace in production', () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('Test error');

      const formatted = formatError(error);

      expect(formatted.stack).toBeUndefined();
    });

    it('should include error code if present', () => {
      const error = Object.assign(new Error('Not found'), {
        code: 'EMPLOYEE_NOT_FOUND',
      });

      const formatted = formatError(error);

      expect(formatted.code).toBe('EMPLOYEE_NOT_FOUND');
    });

    it('should handle custom error types', () => {
      class CustomError extends Error {
        constructor(
          message: string,
          public code: string
        ) {
          super(message);
          this.name = 'CustomError';
        }
      }

      const error = new CustomError('Custom error', 'CUSTOM_CODE');
      const formatted = formatError(error);

      expect(formatted.name).toBe('CustomError');
      expect(formatted.message).toBe('Custom error');
      expect(formatted.code).toBe('CUSTOM_CODE');
    });
  });

  describe('Sensitive fields coverage', () => {
    // Verify all sensitive fields we care about are redacted
    const sensitiveTestCases = [
      { field: 'password', value: 'secret' },
      { field: 'newPassword', value: 'newsecret' },
      { field: 'currentPassword', value: 'oldsecret' },
      { field: 'token', value: 'jwt-token' },
      { field: 'accessToken', value: 'access' },
      { field: 'refreshToken', value: 'refresh' },
      { field: 'secret', value: 'mysecret' },
      { field: 'apiKey', value: 'sk_live_123' },
      { field: 'authorization', value: 'Bearer xyz' },
      { field: 'cookie', value: 'session=abc' },
      { field: 'ssn', value: '123-45-6789' },
      { field: 'creditCard', value: '4111111111111111' },
    ];

    sensitiveTestCases.forEach(({ field, value }) => {
      it(`should redact ${field}`, () => {
        const data = { [field]: value };
        const scrubbed = scrubSensitiveData(data);
        expect(scrubbed[field]).toBe('[REDACTED]');
      });
    });
  });
});
