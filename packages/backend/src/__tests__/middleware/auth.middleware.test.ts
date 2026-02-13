import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Set env before module loads
vi.hoisted(() => {
  process.env['ZITADEL_ISSUER'] = 'https://test.zitadel.example';
});

// Shared state to control mock behavior per test
const state = vi.hoisted(() => ({
  jwtPayload: {} as Record<string, unknown>,
  shouldJwtFail: false,
  employeeRows: [] as unknown[],
}));

// Mock jose
vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(() => 'mock-jwks'),
  jwtVerify: vi.fn(async () => {
    if (state.shouldJwtFail) {
      throw new Error('Invalid token');
    }
    return { payload: state.jwtPayload };
  }),
}));

// Mock DB — supports the chained query pattern: db.select().from().where().limit()
vi.mock('../../db/index.js', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(state.employeeRows),
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve(),
      }),
    }),
  },
}));

vi.mock('../../db/schema/index.js', () => ({
  employees: { zitadelId: 'zitadel_id', id: 'id', email: 'email' },
}));

vi.mock('../../services/auth.service.js', () => ({
  getEmployeeByEmail: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
}));

// Import middleware after mocks
import { requireAuth } from '../../middleware/auth.middleware.js';

// Helper: Express app with requireAuth protecting a test route
function createApp() {
  const app = express();
  app.get(
    '/protected',
    requireAuth as express.RequestHandler,
    ((req: express.Request, res: express.Response) => {
      res.json({
        zitadelUser: (req as any).zitadelUser,
        employee: (req as any).employee || null,
      });
    }) as express.RequestHandler
  );
  return app;
}

// Helper: build a Zitadel JWT payload with roles
function makePayload(
  roles: Record<string, unknown> = {},
  extra: Record<string, unknown> = {}
) {
  return {
    sub: 'test-user-123',
    email: 'test@example.com',
    name: 'Test User',
    'urn:zitadel:iam:org:project:roles': roles,
    ...extra,
  };
}

describe('requireAuth middleware — Zitadel role gate', () => {
  beforeEach(() => {
    state.shouldJwtFail = false;
    state.employeeRows = [];
    state.jwtPayload = makePayload();
  });

  // --- Authentication checks ---

  it('returns 401 when no Authorization header is present', async () => {
    const res = await request(createApp()).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('returns 401 when JWT verification fails', async () => {
    state.shouldJwtFail = true;
    const res = await request(createApp())
      .get('/protected')
      .set('Authorization', 'Bearer invalid-token');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid or expired token');
  });

  // --- Role gating (the new behavior) ---

  it('returns 403 when user has no roles', async () => {
    state.jwtPayload = makePayload({});
    const res = await request(createApp())
      .get('/protected')
      .set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('You do not have access to this application.');
  });

  it('returns 403 when user has wrong app role', async () => {
    state.jwtPayload = makePayload({ 'app:proposal-rodeo': { '123': 'org' } });
    const res = await request(createApp())
      .get('/protected')
      .set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('You do not have access to this application.');
  });

  it('allows admin users', async () => {
    state.jwtPayload = makePayload({ admin: { '123': 'org' } });
    const res = await request(createApp())
      .get('/protected')
      .set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(200);
    expect(res.body.zitadelUser.isAdmin).toBe(true);
    expect(res.body.zitadelUser.roles).toContain('admin');
  });

  it('allows users with app:renewal-timesheets role', async () => {
    state.jwtPayload = makePayload({
      'app:renewal-timesheets': { '123': 'org' },
    });
    const res = await request(createApp())
      .get('/protected')
      .set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(200);
    expect(res.body.zitadelUser.roles).toContain('app:renewal-timesheets');
  });

  // --- Employee record is now non-blocking ---

  it('proceeds without employee when no DB record exists', async () => {
    state.jwtPayload = makePayload({
      'app:renewal-timesheets': { '123': 'org' },
    });
    state.employeeRows = [];
    const res = await request(createApp())
      .get('/protected')
      .set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(200);
    expect(res.body.employee).toBeNull();
  });

  it('attaches employee when DB record exists', async () => {
    state.jwtPayload = makePayload({
      'app:renewal-timesheets': { '123': 'org' },
    });
    state.employeeRows = [
      {
        id: 'emp-1',
        name: 'Test Employee',
        email: 'test@example.com',
        dateOfBirth: null,
        status: 'active',
        isSupervisor: false,
        createdAt: new Date().toISOString(),
        zitadelId: 'test-user-123',
      },
    ];
    const res = await request(createApp())
      .get('/protected')
      .set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(200);
    expect(res.body.employee).not.toBeNull();
    expect(res.body.employee.id).toBe('emp-1');
  });

  it('admin role overrides isSupervisor on employee', async () => {
    state.jwtPayload = makePayload({ admin: { '123': 'org' } });
    state.employeeRows = [
      {
        id: 'emp-2',
        name: 'Regular Employee',
        email: 'test@example.com',
        dateOfBirth: null,
        status: 'active',
        isSupervisor: false,
        createdAt: new Date().toISOString(),
        zitadelId: 'test-user-123',
      },
    ];
    const res = await request(createApp())
      .get('/protected')
      .set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(200);
    expect(res.body.employee.isSupervisor).toBe(true);
  });
});
