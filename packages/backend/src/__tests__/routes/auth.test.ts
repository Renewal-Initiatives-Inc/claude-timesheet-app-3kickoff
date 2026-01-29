import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Mock all dependencies before importing app
vi.mock('../../db/index.js', () => ({
  db: {
    query: {
      employees: {
        findFirst: vi.fn(),
      },
      sessions: {
        findFirst: vi.fn(),
      },
      passwordResetTokens: {
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
    sessions: {},
    passwordResetTokens: {},
  },
}));

vi.mock('../../config/env.js', () => ({
  env: {
    NODE_ENV: 'test',
    PORT: 3001,
    FRONTEND_URL: 'http://localhost:5173',
    JWT_SECRET: 'test-secret-key-that-is-at-least-32-characters-long',
    JWT_EXPIRES_IN: '7d',
    POSTMARK_API_KEY: undefined,
    EMAIL_FROM: 'test@test.com',
    PASSWORD_RESET_EXPIRES_HOURS: 24,
    MAX_LOGIN_ATTEMPTS: 5,
    LOCKOUT_DURATION_MINUTES: 30,
    APP_URL: 'http://localhost:5173',
  },
}));

// Mock JWT verification to return a valid payload for "valid-token"
vi.mock('../../utils/jwt.js', () => ({
  signToken: vi.fn(() => 'mock-jwt-token'),
  verifyToken: vi.fn((token: string) => {
    if (token === 'valid-token') {
      return {
        employeeId: 'emp-123',
        email: 'test@example.com',
        isSupervisor: false,
      };
    }
    return null;
  }),
}));

import app from '../../app.js';
import { db } from '../../db/index.js';
import bcrypt from 'bcryptjs';

describe('Auth Routes', () => {
  const mockEmployee = {
    id: 'emp-123',
    name: 'Test User',
    email: 'test@example.com',
    dateOfBirth: '1990-01-15',
    isSupervisor: false,
    status: 'active',
    passwordHash: '',
    failedLoginAttempts: 0,
    lockedUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSupervisor = {
    ...mockEmployee,
    id: 'supervisor-123',
    email: 'supervisor@example.com',
    isSupervisor: true,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    // Hash password for mock employee
    mockEmployee.passwordHash = await bcrypt.hash('TestPass123!', 10);
    mockSupervisor.passwordHash = await bcrypt.hash('TestPass123!', 10);
  });

  describe('POST /api/auth/login', () => {
    it('should return 200 with token on successful login', async () => {
      vi.mocked(db.query.employees.findFirst).mockResolvedValue(mockEmployee);
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: 'session-123',
              token: 'jwt-token',
              expiresAt: new Date(Date.now() + 86400000),
            },
          ]),
        }),
      } as never);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'TestPass123!' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('employee');
      expect(response.body.employee.email).toBe('test@example.com');
    });

    it('should return 401 for wrong password', async () => {
      vi.mocked(db.query.employees.findFirst).mockResolvedValue(mockEmployee);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'WrongPassword' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('INVALID_CREDENTIALS');
    });

    it('should return 401 for non-existent email', async () => {
      vi.mocked(db.query.employees.findFirst).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'TestPass123!' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('INVALID_CREDENTIALS');
    });

    it('should return 423 for locked account', async () => {
      const lockedEmployee = {
        ...mockEmployee,
        lockedUntil: new Date(Date.now() + 60000),
      };
      vi.mocked(db.query.employees.findFirst).mockResolvedValue(lockedEmployee);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'TestPass123!' });

      expect(response.status).toBe(423);
      expect(response.body.error).toBe('ACCOUNT_LOCKED');
    });

    it('should return 400 for missing email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ password: 'TestPass123!' });

      expect(response.status).toBe(400);
    });

    it('should return 400 for missing password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'not-an-email', password: 'TestPass123!' });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should return 204 on successful logout', async () => {
      // Mock successful auth
      vi.mocked(db.query.employees.findFirst).mockResolvedValue(mockEmployee);
      vi.mocked(db.query.sessions.findFirst).mockResolvedValue({
        id: 'session-123',
        employeeId: mockEmployee.id,
        token: 'valid-token',
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
        createdAt: new Date(),
      });

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(204);
    });

    it('should return 401 without token', async () => {
      const response = await request(app).post('/api/auth/logout');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user with valid token', async () => {
      vi.mocked(db.query.employees.findFirst).mockResolvedValue(mockEmployee);
      vi.mocked(db.query.sessions.findFirst).mockResolvedValue({
        id: 'session-123',
        employeeId: mockEmployee.id,
        token: 'valid-token',
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
        createdAt: new Date(),
      });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('employee');
      expect(response.body.employee.email).toBe('test@example.com');
    });

    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/auth/register', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app).post('/api/auth/register').send({
        name: 'New User',
        email: 'new@example.com',
        dateOfBirth: '1990-01-15',
        tempPassword: 'TempPass123!',
      });

      expect(response.status).toBe(401);
    });

    it('should return 403 for non-supervisor', async () => {
      // Mock non-supervisor auth
      vi.mocked(db.query.employees.findFirst).mockResolvedValue(mockEmployee);
      vi.mocked(db.query.sessions.findFirst).mockResolvedValue({
        id: 'session-123',
        employeeId: mockEmployee.id,
        token: 'valid-token',
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
        createdAt: new Date(),
      });

      const response = await request(app)
        .post('/api/auth/register')
        .set('Authorization', 'Bearer valid-token')
        .send({
          name: 'New User',
          email: 'new@example.com',
          dateOfBirth: '1990-01-15',
          tempPassword: 'TempPass123!',
        });

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/auth/password-reset/request', () => {
    it('should return 200 even for non-existent email', async () => {
      vi.mocked(db.query.employees.findFirst).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/auth/password-reset/request')
        .send({ email: 'nonexistent@example.com' });

      // Should always return success to avoid revealing email existence
      expect(response.status).toBe(200);
    });

    it('should return 200 for existing email', async () => {
      vi.mocked(db.query.employees.findFirst).mockResolvedValue(mockEmployee);

      const response = await request(app)
        .post('/api/auth/password-reset/request')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(200);
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/password-reset/request')
        .send({ email: 'not-an-email' });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/auth/password-reset/validate', () => {
    it('should return 200 for valid token', async () => {
      vi.mocked(db.query.passwordResetTokens.findFirst).mockResolvedValue({
        id: 'reset-123',
        token: 'valid-reset-token',
        expiresAt: new Date(Date.now() + 86400000),
        usedAt: null,
        employee: mockEmployee,
      });

      const response = await request(app)
        .post('/api/auth/password-reset/validate')
        .send({ token: 'valid-reset-token' });

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(true);
    });

    it('should return 400 for invalid token', async () => {
      vi.mocked(db.query.passwordResetTokens.findFirst).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/auth/password-reset/validate')
        .send({ token: 'invalid-token' });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/auth/password-reset/complete', () => {
    it('should return 200 on successful password reset', async () => {
      vi.mocked(db.query.passwordResetTokens.findFirst).mockResolvedValue({
        id: 'reset-123',
        employeeId: 'emp-123',
        token: 'valid-token',
        expiresAt: new Date(Date.now() + 86400000),
        usedAt: null,
        employee: mockEmployee,
      });

      const response = await request(app)
        .post('/api/auth/password-reset/complete')
        .send({ token: 'valid-token', newPassword: 'NewPass123!' });

      expect(response.status).toBe(200);
    });

    it('should return 400 for weak password', async () => {
      const response = await request(app)
        .post('/api/auth/password-reset/complete')
        .send({ token: 'valid-token', newPassword: 'weak' });

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid token', async () => {
      vi.mocked(db.query.passwordResetTokens.findFirst).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/auth/password-reset/complete')
        .send({ token: 'invalid-token', newPassword: 'NewPass123!' });

      expect(response.status).toBe(400);
    });
  });
});
