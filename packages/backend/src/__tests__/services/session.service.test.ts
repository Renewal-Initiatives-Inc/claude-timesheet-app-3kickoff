import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
const mockSessions: Record<string, unknown>[] = [];

vi.mock('../../db/index.js', () => ({
  db: {
    query: {
      employees: {
        findFirst: vi.fn(),
      },
      sessions: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn((data) => ({
        returning: vi.fn(() => {
          const session = {
            id: 'session-123',
            ...data,
            createdAt: new Date(),
          };
          mockSessions.push(session);
          return Promise.resolve([session]);
        }),
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
  },
}));

vi.mock('../../utils/jwt.js', () => ({
  signToken: vi.fn(() => 'mock-jwt-token'),
  verifyToken: vi.fn(),
}));

vi.mock('../../config/env.js', () => ({
  env: {
    JWT_SECRET: 'test-secret-key-that-is-at-least-32-characters-long',
    JWT_EXPIRES_IN: '7d',
  },
}));

import { db } from '../../db/index.js';
import { signToken } from '../../utils/jwt.js';
import {
  createSession,
  getActiveSession,
  revokeSession,
  revokeAllSessions,
  cleanupExpiredSessions,
} from '../../services/session.service.js';

describe('Session Service', () => {
  const mockEmployee = {
    id: 'emp-123',
    name: 'Test User',
    email: 'test@example.com',
    isSupervisor: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSessions.length = 0;
  });

  describe('createSession', () => {
    it('should create a new session', async () => {
      vi.mocked(db.query.employees.findFirst).mockResolvedValue(mockEmployee);

      const result = await createSession('emp-123');

      expect(result.token).toBe('mock-jwt-token');
      expect(result.session).toBeDefined();
      expect(signToken).toHaveBeenCalledWith({
        employeeId: 'emp-123',
        email: 'test@example.com',
        isSupervisor: false,
      });
    });

    it('should throw error if employee not found', async () => {
      vi.mocked(db.query.employees.findFirst).mockResolvedValue(undefined);

      await expect(createSession('nonexistent')).rejects.toThrow('Employee not found');
    });

    it('should set expiration based on JWT_EXPIRES_IN', async () => {
      vi.mocked(db.query.employees.findFirst).mockResolvedValue(mockEmployee);

      await createSession('emp-123');

      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe('getActiveSession', () => {
    it('should return session if valid', async () => {
      const mockSession = {
        id: 'session-123',
        employeeId: 'emp-123',
        token: 'valid-token',
        expiresAt: new Date(Date.now() + 86400000), // 1 day from now
        revokedAt: null,
        createdAt: new Date(),
      };
      vi.mocked(db.query.sessions.findFirst).mockResolvedValue(mockSession);

      const result = await getActiveSession('valid-token');

      expect(result).toEqual(mockSession);
    });

    it('should return null if session not found', async () => {
      vi.mocked(db.query.sessions.findFirst).mockResolvedValue(undefined);

      const result = await getActiveSession('invalid-token');

      expect(result).toBeNull();
    });
  });

  describe('revokeSession', () => {
    it('should update session with revokedAt timestamp', async () => {
      await revokeSession('token-to-revoke');

      expect(db.update).toHaveBeenCalled();
    });
  });

  describe('revokeAllSessions', () => {
    it('should revoke all sessions for an employee', async () => {
      await revokeAllSessions('emp-123');

      expect(db.update).toHaveBeenCalled();
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should delete expired sessions', async () => {
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: '1' }, { id: '2' }]),
        }),
      } as never);

      const result = await cleanupExpiredSessions();

      expect(result).toBe(2);
      expect(db.delete).toHaveBeenCalled();
    });

    it('should return 0 if no expired sessions', async () => {
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      } as never);

      const result = await cleanupExpiredSessions();

      expect(result).toBe(0);
    });
  });
});
