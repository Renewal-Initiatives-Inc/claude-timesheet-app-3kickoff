import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  generateSecureToken,
  validatePasswordStrength,
} from '../../utils/password.js';

describe('Password Utilities', () => {
  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const password = 'TestPass123!';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.startsWith('$2b$')).toBe(true); // bcrypt hash prefix
    });

    it('should produce different hashes for the same password (salt)', async () => {
      const password = 'TestPass123!';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty string', async () => {
      const hash = await hashPassword('');
      expect(hash).toBeDefined();
    });

    it('should handle very long passwords', async () => {
      const longPassword = 'a'.repeat(1000);
      const hash = await hashPassword(longPassword);
      expect(hash).toBeDefined();
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'TestPass123!';
      const hash = await hashPassword(password);

      const result = await verifyPassword(password, hash);
      expect(result).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'TestPass123!';
      const hash = await hashPassword(password);

      const result = await verifyPassword('WrongPassword', hash);
      expect(result).toBe(false);
    });

    it('should reject empty password against valid hash', async () => {
      const password = 'TestPass123!';
      const hash = await hashPassword(password);

      const result = await verifyPassword('', hash);
      expect(result).toBe(false);
    });

    it('should handle case-sensitive passwords', async () => {
      const password = 'TestPass123!';
      const hash = await hashPassword(password);

      const result = await verifyPassword('testpass123!', hash);
      expect(result).toBe(false);
    });
  });

  describe('generateSecureToken', () => {
    it('should generate a 64-character hex string (256 bits)', () => {
      const token = generateSecureToken();

      expect(token).toBeDefined();
      expect(token.length).toBe(64); // 32 bytes = 64 hex chars
      expect(/^[a-f0-9]+$/.test(token)).toBe(true);
    });

    it('should generate unique tokens', () => {
      const tokens = new Set();
      for (let i = 0; i < 100; i++) {
        tokens.add(generateSecureToken());
      }
      expect(tokens.size).toBe(100);
    });
  });

  describe('validatePasswordStrength', () => {
    it('should accept valid password', () => {
      const result = validatePasswordStrength('TestPass1');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject password shorter than 8 characters', () => {
      const result = validatePasswordStrength('Test1');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should reject password without letters', () => {
      const result = validatePasswordStrength('12345678');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one letter');
    });

    it('should reject password without numbers', () => {
      const result = validatePasswordStrength('TestPassword');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should return multiple errors for very weak password', () => {
      const result = validatePasswordStrength('abc');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });

    it('should accept password with special characters', () => {
      const result = validatePasswordStrength('Test123!@#');
      expect(result.valid).toBe(true);
    });

    it('should accept password with only lowercase and numbers', () => {
      const result = validatePasswordStrength('password1');
      expect(result.valid).toBe(true);
    });

    it('should accept password with only uppercase and numbers', () => {
      const result = validatePasswordStrength('PASSWORD1');
      expect(result.valid).toBe(true);
    });
  });
});
