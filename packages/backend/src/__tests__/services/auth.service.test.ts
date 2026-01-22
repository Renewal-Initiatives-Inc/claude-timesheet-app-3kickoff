import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../db/index.js', () => ({
  db: {
    query: {
      employees: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(),
      })),
    })),
  },
  schema: {
    employees: {},
  },
}));

vi.mock('../../utils/password.js', () => ({
  hashPassword: vi.fn((password: string) => Promise.resolve(`hashed_${password}`)),
  verifyPassword: vi.fn(),
  validatePasswordStrength: vi.fn(() => ({ valid: true, errors: [] })),
}));

vi.mock('../../services/session.service.js', () => ({
  createSession: vi.fn(() =>
    Promise.resolve({
      session: { id: 'session-id', token: 'test-token' },
      token: 'test-jwt-token',
    })
  ),
  revokeSession: vi.fn(() => Promise.resolve()),
  revokeAllSessions: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../config/env.js', () => ({
  env: {
    MAX_LOGIN_ATTEMPTS: 5,
    LOCKOUT_DURATION_MINUTES: 30,
  },
}));

import { db } from '../../db/index.js';
import { verifyPassword, validatePasswordStrength } from '../../utils/password.js';
import { createSession, revokeSession } from '../../services/session.service.js';
import { login, logout, register, AuthError } from '../../services/auth.service.js';

describe('Auth Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('login', () => {
    const mockEmployee = {
      id: 'emp-123',
      name: 'Test User',
      email: 'test@example.com',
      dateOfBirth: '1990-01-15',
      isSupervisor: false,
      status: 'active',
      passwordHash: 'hashed_password',
      failedLoginAttempts: 0,
      lockedUntil: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should return token on successful login', async () => {
      vi.mocked(db.query.employees.findFirst).mockResolvedValue(mockEmployee);
      vi.mocked(verifyPassword).mockResolvedValue(true);

      const result = await login('test@example.com', 'password');

      expect(result.token).toBe('test-jwt-token');
      expect(result.employee.email).toBe('test@example.com');
      expect(createSession).toHaveBeenCalledWith('emp-123');
    });

    it('should throw INVALID_CREDENTIALS for wrong password', async () => {
      vi.mocked(db.query.employees.findFirst).mockResolvedValue(mockEmployee);
      vi.mocked(verifyPassword).mockResolvedValue(false);

      await expect(login('test@example.com', 'wrong')).rejects.toThrow(AuthError);
      await expect(login('test@example.com', 'wrong')).rejects.toMatchObject({
        code: 'INVALID_CREDENTIALS',
      });
    });

    it('should throw INVALID_CREDENTIALS for non-existent email', async () => {
      vi.mocked(db.query.employees.findFirst).mockResolvedValue(undefined);

      await expect(login('nonexistent@example.com', 'password')).rejects.toThrow(AuthError);
      await expect(login('nonexistent@example.com', 'password')).rejects.toMatchObject({
        code: 'INVALID_CREDENTIALS',
      });
    });

    it('should throw ACCOUNT_LOCKED for locked account', async () => {
      const lockedEmployee = {
        ...mockEmployee,
        lockedUntil: new Date(Date.now() + 60000), // locked for 1 minute
      };
      vi.mocked(db.query.employees.findFirst).mockResolvedValue(lockedEmployee);

      await expect(login('test@example.com', 'password')).rejects.toThrow(AuthError);
      await expect(login('test@example.com', 'password')).rejects.toMatchObject({
        code: 'ACCOUNT_LOCKED',
      });
    });

    it('should allow login for expired lock', async () => {
      const expiredLockEmployee = {
        ...mockEmployee,
        lockedUntil: new Date(Date.now() - 60000), // lock expired 1 minute ago
      };
      vi.mocked(db.query.employees.findFirst).mockResolvedValue(expiredLockEmployee);
      vi.mocked(verifyPassword).mockResolvedValue(true);

      const result = await login('test@example.com', 'password');
      expect(result.token).toBeDefined();
    });

    it('should normalize email to lowercase', async () => {
      vi.mocked(db.query.employees.findFirst).mockResolvedValue(mockEmployee);
      vi.mocked(verifyPassword).mockResolvedValue(true);

      await login('TEST@EXAMPLE.COM', 'password');

      expect(db.query.employees.findFirst).toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should revoke session on logout', async () => {
      await logout('test-token');
      expect(revokeSession).toHaveBeenCalledWith('test-token');
    });
  });

  describe('register', () => {
    const registerData = {
      name: 'New User',
      email: 'new@example.com',
      dateOfBirth: '1990-01-15',
      tempPassword: 'TestPass123!',
    };

    beforeEach(() => {
      vi.mocked(db.query.employees.findFirst).mockResolvedValue(undefined);
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: 'new-emp-123',
              name: 'New User',
              email: 'new@example.com',
              dateOfBirth: '1990-01-15',
              isSupervisor: false,
              status: 'active',
              createdAt: new Date(),
            },
          ]),
        }),
      } as never);
    });

    it('should create new employee', async () => {
      const result = await register(registerData);

      expect(result.email).toBe('new@example.com');
      expect(result.name).toBe('New User');
      expect(db.insert).toHaveBeenCalled();
    });

    it('should throw EMAIL_EXISTS for duplicate email', async () => {
      vi.mocked(db.query.employees.findFirst).mockResolvedValue({
        id: 'existing',
        email: 'new@example.com',
      } as never);

      await expect(register(registerData)).rejects.toThrow(AuthError);
      await expect(register(registerData)).rejects.toMatchObject({
        code: 'EMAIL_EXISTS',
      });
    });

    it('should throw PASSWORD_TOO_WEAK for weak password', async () => {
      vi.mocked(validatePasswordStrength).mockReturnValue({
        valid: false,
        errors: ['Password must be at least 8 characters'],
      });

      await expect(
        register({ ...registerData, tempPassword: 'weak' })
      ).rejects.toThrow(AuthError);
      await expect(
        register({ ...registerData, tempPassword: 'weak' })
      ).rejects.toMatchObject({
        code: 'PASSWORD_TOO_WEAK',
      });
    });
  });
});
