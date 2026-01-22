import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the env module before importing jwt
vi.mock('../../config/env.js', () => ({
  env: {
    JWT_SECRET: 'test-secret-key-that-is-at-least-32-characters-long',
    JWT_EXPIRES_IN: '1h',
  },
}));

import { signToken, verifyToken, TokenPayload } from '../../utils/jwt.js';

describe('JWT Utilities', () => {
  const validPayload: Omit<TokenPayload, 'iat' | 'exp'> = {
    employeeId: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    isSupervisor: false,
  };

  describe('signToken', () => {
    it('should sign a token with payload', () => {
      const token = signToken(validPayload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      // JWT format: header.payload.signature
      expect(token.split('.').length).toBe(3);
    });

    it('should include employeeId in signed token', () => {
      const token = signToken(validPayload);
      const decoded = verifyToken(token);

      expect(decoded?.employeeId).toBe(validPayload.employeeId);
    });

    it('should include email in signed token', () => {
      const token = signToken(validPayload);
      const decoded = verifyToken(token);

      expect(decoded?.email).toBe(validPayload.email);
    });

    it('should include isSupervisor flag in signed token', () => {
      const token = signToken({ ...validPayload, isSupervisor: true });
      const decoded = verifyToken(token);

      expect(decoded?.isSupervisor).toBe(true);
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', () => {
      const token = signToken(validPayload);
      const decoded = verifyToken(token);

      expect(decoded).not.toBeNull();
      expect(decoded?.employeeId).toBe(validPayload.employeeId);
      expect(decoded?.email).toBe(validPayload.email);
      expect(decoded?.isSupervisor).toBe(validPayload.isSupervisor);
    });

    it('should return null for invalid token', () => {
      const result = verifyToken('invalid-token');
      expect(result).toBeNull();
    });

    it('should return null for tampered token', () => {
      const token = signToken(validPayload);
      // Tamper with the signature
      const [header, payload] = token.split('.');
      const tamperedToken = `${header}.${payload}.tampered-signature`;

      const result = verifyToken(tamperedToken);
      expect(result).toBeNull();
    });

    it('should return null for empty string', () => {
      const result = verifyToken('');
      expect(result).toBeNull();
    });

    it('should include iat (issued at) in decoded token', () => {
      const token = signToken(validPayload);
      const decoded = verifyToken(token);

      expect(decoded?.iat).toBeDefined();
      expect(typeof decoded?.iat).toBe('number');
    });

    it('should include exp (expiration) in decoded token', () => {
      const token = signToken(validPayload);
      const decoded = verifyToken(token);

      expect(decoded?.exp).toBeDefined();
      expect(typeof decoded?.exp).toBe('number');
      // exp should be greater than iat
      expect(decoded!.exp).toBeGreaterThan(decoded!.iat!);
    });
  });

  describe('Token Expiration', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should reject expired token', async () => {
      const token = signToken(validPayload);

      // Fast forward 2 hours (token expires in 1 hour)
      vi.advanceTimersByTime(2 * 60 * 60 * 1000);

      const result = verifyToken(token);
      expect(result).toBeNull();
    });

    it('should accept token within expiration window', () => {
      const token = signToken(validPayload);

      // Fast forward 30 minutes (within 1 hour expiration)
      vi.advanceTimersByTime(30 * 60 * 1000);

      const result = verifyToken(token);
      expect(result).not.toBeNull();
    });
  });
});
