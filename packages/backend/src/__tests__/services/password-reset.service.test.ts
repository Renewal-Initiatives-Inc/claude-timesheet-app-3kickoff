import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../db/index.js', () => ({
  db: {
    query: {
      employees: {
        findFirst: vi.fn(),
      },
      passwordResetTokens: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => Promise.resolve()),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([])),
      })),
    })),
  },
  schema: {
    employees: {},
    passwordResetTokens: {},
  },
}));

vi.mock('../../utils/password.js', () => ({
  generateSecureToken: vi.fn(() => 'secure-reset-token'),
  validatePasswordStrength: vi.fn(() => ({ valid: true, errors: [] })),
}));

vi.mock('../../services/auth.service.js', () => ({
  changePassword: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/email.service.js', () => ({
  sendPasswordResetEmail: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../config/env.js', () => ({
  env: {
    PASSWORD_RESET_EXPIRES_HOURS: 24,
    APP_URL: 'http://localhost:5173',
  },
}));

import { db } from '../../db/index.js';
import { validatePasswordStrength } from '../../utils/password.js';
import { changePassword } from '../../services/auth.service.js';
import { sendPasswordResetEmail } from '../../services/email.service.js';
import {
  requestPasswordReset,
  validateResetToken,
  completePasswordReset,
  PasswordResetError,
} from '../../services/password-reset.service.js';

describe('Password Reset Service', () => {
  const mockEmployee = {
    id: 'emp-123',
    name: 'Test User',
    email: 'test@example.com',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('requestPasswordReset', () => {
    it('should create reset token and send email for existing user', async () => {
      vi.mocked(db.query.employees.findFirst).mockResolvedValue(mockEmployee);

      await requestPasswordReset('test@example.com');

      expect(db.insert).toHaveBeenCalled();
      expect(sendPasswordResetEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.stringContaining('secure-reset-token'),
        'Test User'
      );
    });

    it('should not throw error for non-existent email (timing-safe)', async () => {
      vi.mocked(db.query.employees.findFirst).mockResolvedValue(undefined);

      // Should not throw
      await expect(requestPasswordReset('nonexistent@example.com')).resolves.not.toThrow();

      // Should not send email
      expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should normalize email to lowercase', async () => {
      vi.mocked(db.query.employees.findFirst).mockResolvedValue(mockEmployee);

      await requestPasswordReset('TEST@EXAMPLE.COM');

      expect(db.query.employees.findFirst).toHaveBeenCalled();
    });
  });

  describe('validateResetToken', () => {
    it('should return employee for valid token', async () => {
      vi.mocked(db.query.passwordResetTokens.findFirst).mockResolvedValue({
        id: 'reset-123',
        token: 'valid-token',
        expiresAt: new Date(Date.now() + 86400000),
        usedAt: null,
        employee: mockEmployee,
      });

      const result = await validateResetToken('valid-token');

      expect(result).toEqual(mockEmployee);
    });

    it('should return null for invalid token', async () => {
      vi.mocked(db.query.passwordResetTokens.findFirst).mockResolvedValue(undefined);

      const result = await validateResetToken('invalid-token');

      expect(result).toBeNull();
    });
  });

  describe('completePasswordReset', () => {
    it('should update password for valid token', async () => {
      vi.mocked(db.query.passwordResetTokens.findFirst).mockResolvedValue({
        id: 'reset-123',
        employeeId: 'emp-123',
        token: 'valid-token',
        expiresAt: new Date(Date.now() + 86400000),
        usedAt: null,
        employee: mockEmployee,
      });

      await completePasswordReset('valid-token', 'NewPass123!');

      expect(db.update).toHaveBeenCalled(); // Mark token as used
      expect(changePassword).toHaveBeenCalledWith('emp-123', 'NewPass123!');
    });

    it('should throw INVALID_TOKEN for non-existent token', async () => {
      vi.mocked(db.query.passwordResetTokens.findFirst).mockResolvedValue(undefined);

      await expect(completePasswordReset('invalid', 'NewPass123!')).rejects.toThrow(
        PasswordResetError
      );
      await expect(completePasswordReset('invalid', 'NewPass123!')).rejects.toMatchObject({
        code: 'INVALID_TOKEN',
      });
    });

    it('should throw TOKEN_USED for already used token', async () => {
      vi.mocked(db.query.passwordResetTokens.findFirst).mockResolvedValue({
        id: 'reset-123',
        token: 'used-token',
        expiresAt: new Date(Date.now() + 86400000),
        usedAt: new Date(), // Already used
        employee: mockEmployee,
      });

      await expect(completePasswordReset('used-token', 'NewPass123!')).rejects.toThrow(
        PasswordResetError
      );
      await expect(completePasswordReset('used-token', 'NewPass123!')).rejects.toMatchObject({
        code: 'TOKEN_USED',
      });
    });

    it('should throw TOKEN_EXPIRED for expired token', async () => {
      vi.mocked(db.query.passwordResetTokens.findFirst).mockResolvedValue({
        id: 'reset-123',
        token: 'expired-token',
        expiresAt: new Date(Date.now() - 86400000), // Expired 1 day ago
        usedAt: null,
        employee: mockEmployee,
      });

      await expect(completePasswordReset('expired-token', 'NewPass123!')).rejects.toThrow(
        PasswordResetError
      );
      await expect(completePasswordReset('expired-token', 'NewPass123!')).rejects.toMatchObject({
        code: 'TOKEN_EXPIRED',
      });
    });

    it('should throw PASSWORD_TOO_WEAK for weak password', async () => {
      vi.mocked(validatePasswordStrength).mockReturnValue({
        valid: false,
        errors: ['Password must be at least 8 characters'],
      });

      await expect(completePasswordReset('token', 'weak')).rejects.toThrow(PasswordResetError);
      await expect(completePasswordReset('token', 'weak')).rejects.toMatchObject({
        code: 'PASSWORD_TOO_WEAK',
      });
    });
  });
});
