import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';

// Import the actual middleware
import {
  csrfProtection,
  csrfTokenEndpoint,
  csrfTokenGenerator,
} from '../../middleware/csrf.middleware.js';

describe('CSRF Middleware', () => {
  // Store original env vars
  const originalEnv = process.env.NODE_ENV;
  const originalDisableCsrf = process.env.DISABLE_CSRF;
  const originalDisableSecure = process.env.DISABLE_SECURE_COOKIES;

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    delete process.env.DISABLE_CSRF;
    delete process.env.DISABLE_SECURE_COOKIES;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    if (originalDisableCsrf !== undefined) process.env.DISABLE_CSRF = originalDisableCsrf;
    else delete process.env.DISABLE_CSRF;
    if (originalDisableSecure !== undefined) process.env.DISABLE_SECURE_COOKIES = originalDisableSecure;
    else delete process.env.DISABLE_SECURE_COOKIES;
  });

  describe('csrfTokenEndpoint', () => {
    it('should return a CSRF token and set cookie', async () => {
      const app = express();
      app.use(cookieParser());
      app.get('/csrf-token', csrfTokenEndpoint);

      const response = await request(app).get('/csrf-token');

      expect(response.status).toBe(200);
      expect(response.body.csrfToken).toBeDefined();
      expect(response.body.csrfToken).toHaveLength(64); // 32 bytes hex = 64 chars

      // Check cookie was set
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain('_csrf=');
    });

    it('should set secure cookie by default', async () => {
      const app = express();
      app.use(cookieParser());
      app.get('/csrf-token', csrfTokenEndpoint);

      const response = await request(app).get('/csrf-token');

      const cookies = response.headers['set-cookie'];
      expect(cookies[0]).toContain('Secure');
    });

    it('should allow non-secure cookie when DISABLE_SECURE_COOKIES is set', async () => {
      process.env.DISABLE_SECURE_COOKIES = 'true';

      const app = express();
      app.use(cookieParser());
      app.get('/csrf-token', csrfTokenEndpoint);

      const response = await request(app).get('/csrf-token');

      const cookies = response.headers['set-cookie'];
      expect(cookies[0]).not.toContain('Secure');
    });
  });

  describe('csrfProtection', () => {
    it('should allow GET requests without CSRF token', async () => {
      const app = express();
      app.use(cookieParser());
      app.use(csrfProtection);
      app.get('/test', (req, res) => res.json({ success: true }));

      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should allow HEAD requests without CSRF token', async () => {
      const app = express();
      app.use(cookieParser());
      app.use(csrfProtection);
      app.head('/test', (req, res) => res.status(200).end());

      const response = await request(app).head('/test');

      expect(response.status).toBe(200);
    });

    it('should allow OPTIONS requests without CSRF token', async () => {
      const app = express();
      app.use(cookieParser());
      app.use(csrfProtection);
      app.options('/test', (req, res) => res.status(200).end());

      const response = await request(app).options('/test');

      expect(response.status).toBe(200);
    });

    it('should reject POST requests without CSRF token cookie', async () => {
      const app = express();
      app.use(cookieParser());
      app.use(csrfProtection);
      app.post('/test', (req, res) => res.json({ success: true }));

      const response = await request(app).post('/test');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('CSRF_TOKEN_MISSING');
    });

    it('should reject POST requests without CSRF token header', async () => {
      const app = express();
      app.use(cookieParser());
      app.use(csrfProtection);
      app.post('/test', (req, res) => res.json({ success: true }));

      const response = await request(app).post('/test').set('Cookie', '_csrf=validtoken123');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('CSRF_TOKEN_INVALID');
    });

    it('should reject POST requests with mismatched CSRF tokens', async () => {
      const app = express();
      app.use(cookieParser());
      app.use(csrfProtection);
      app.post('/test', (req, res) => res.json({ success: true }));

      const response = await request(app)
        .post('/test')
        .set('Cookie', '_csrf=cookietoken')
        .set('X-CSRF-Token', 'differenttoken');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('CSRF_TOKEN_INVALID');
    });

    it('should allow POST requests with matching CSRF tokens', async () => {
      const app = express();
      app.use(cookieParser());
      app.use(csrfProtection);
      app.post('/test', (req, res) => res.json({ success: true }));

      const token = 'a'.repeat(64); // Valid token format
      const response = await request(app)
        .post('/test')
        .set('Cookie', `_csrf=${token}`)
        .set('X-CSRF-Token', token);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should allow PUT requests with matching CSRF tokens', async () => {
      const app = express();
      app.use(cookieParser());
      app.use(csrfProtection);
      app.put('/test', (req, res) => res.json({ success: true }));

      const token = 'b'.repeat(64);
      const response = await request(app)
        .put('/test')
        .set('Cookie', `_csrf=${token}`)
        .set('X-CSRF-Token', token);

      expect(response.status).toBe(200);
    });

    it('should allow PATCH requests with matching CSRF tokens', async () => {
      const app = express();
      app.use(cookieParser());
      app.use(csrfProtection);
      app.patch('/test', (req, res) => res.json({ success: true }));

      const token = 'c'.repeat(64);
      const response = await request(app)
        .patch('/test')
        .set('Cookie', `_csrf=${token}`)
        .set('X-CSRF-Token', token);

      expect(response.status).toBe(200);
    });

    it('should allow DELETE requests with matching CSRF tokens', async () => {
      const app = express();
      app.use(cookieParser());
      app.use(csrfProtection);
      app.delete('/test', (req, res) => res.json({ success: true }));

      const token = 'd'.repeat(64);
      const response = await request(app)
        .delete('/test')
        .set('Cookie', `_csrf=${token}`)
        .set('X-CSRF-Token', token);

      expect(response.status).toBe(200);
    });

    it('should skip CSRF protection when DISABLE_CSRF is set', async () => {
      process.env.DISABLE_CSRF = 'true';

      const app = express();
      app.use(cookieParser());
      app.use(csrfProtection);
      app.post('/test', (req, res) => res.json({ success: true }));

      // No CSRF token provided, but should still succeed when disabled
      const response = await request(app).post('/test');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('csrfTokenGenerator', () => {
    it('should generate token if none exists', async () => {
      const app = express();
      app.use(cookieParser());
      app.use(csrfTokenGenerator);
      app.get('/test', (req, res) => res.json({ success: true }));

      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain('_csrf=');
    });

    it('should not regenerate token if one exists', async () => {
      const app = express();
      app.use(cookieParser());
      app.use(csrfTokenGenerator);
      app.get('/test', (req, res) => res.json({ success: true }));

      const existingToken = 'existingtoken123';
      const response = await request(app).get('/test').set('Cookie', `_csrf=${existingToken}`);

      expect(response.status).toBe(200);
      // Should not set a new cookie if one already exists
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeUndefined();
    });

    it('should skip when DISABLE_CSRF is set', async () => {
      process.env.DISABLE_CSRF = 'true';

      const app = express();
      app.use(cookieParser());
      app.use(csrfTokenGenerator);
      app.get('/test', (req, res) => res.json({ success: true }));

      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      // Should not set any cookies when disabled
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeUndefined();
    });
  });

  describe('Double-Submit Cookie Pattern Integration', () => {
    it('should complete full CSRF flow: get token, use token', async () => {
      const app = express();
      app.use(cookieParser());
      app.get('/csrf-token', csrfTokenEndpoint);
      app.use(csrfProtection);
      app.post('/protected', (req, res) => res.json({ success: true }));

      // Step 1: Get CSRF token
      const tokenResponse = await request(app).get('/csrf-token');
      expect(tokenResponse.status).toBe(200);

      const csrfToken = tokenResponse.body.csrfToken;
      const cookies = tokenResponse.headers['set-cookie'];
      const cookieValue = cookies[0].split(';')[0]; // Get just the cookie key=value

      // Step 2: Make protected request with token
      const protectedResponse = await request(app)
        .post('/protected')
        .set('Cookie', cookieValue)
        .set('X-CSRF-Token', csrfToken);

      expect(protectedResponse.status).toBe(200);
      expect(protectedResponse.body.success).toBe(true);
    });
  });
});
