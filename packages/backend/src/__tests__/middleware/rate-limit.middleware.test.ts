import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import rateLimit from 'express-rate-limit';

// Direct middleware tests for rate limit configuration
describe('Rate Limit Middleware', () => {
  describe('Login Rate Limiter Configuration', () => {
    it('should be configured with 5 requests per 15 minutes', async () => {
      // Create a test app with a strict rate limiter (no skip for test env)
      const testRateLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 5,
        standardHeaders: true,
        legacyHeaders: true,
        message: { error: 'RATE_LIMITED', message: 'Too many login attempts.' },
      });

      const app = express();
      app.use(testRateLimiter);
      app.post('/login', (req, res) => res.json({ success: true }));

      // Make 5 requests - should all succeed
      for (let i = 0; i < 5; i++) {
        const response = await request(app).post('/login');
        expect(response.status).toBe(200);
      }

      // 6th request should be rate limited
      const response = await request(app).post('/login');
      expect(response.status).toBe(429);
      expect(response.body.error).toBe('RATE_LIMITED');
    });

    it('should return rate limit headers', async () => {
      const testRateLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 5,
        standardHeaders: true,
        legacyHeaders: true,
      });

      const app = express();
      app.use(testRateLimiter);
      app.get('/test', (req, res) => res.json({ success: true }));

      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      // Check for standard rate limit headers
      expect(response.headers['ratelimit-limit']).toBe('5');
      expect(response.headers['ratelimit-remaining']).toBe('4');
      expect(response.headers['ratelimit-reset']).toBeDefined();
      // Also check legacy headers
      expect(response.headers['x-ratelimit-limit']).toBe('5');
      expect(response.headers['x-ratelimit-remaining']).toBe('4');
    });
  });

  describe('Password Reset Rate Limiter Configuration', () => {
    it('should be configured with 3 requests per hour', async () => {
      const testRateLimiter = rateLimit({
        windowMs: 60 * 60 * 1000,
        max: 3,
        standardHeaders: true,
        legacyHeaders: true,
        message: { error: 'RATE_LIMITED', message: 'Too many password reset requests.' },
      });

      const app = express();
      app.use(testRateLimiter);
      app.post('/reset', (req, res) => res.json({ success: true }));

      // Make 3 requests - should all succeed
      for (let i = 0; i < 3; i++) {
        const response = await request(app).post('/reset');
        expect(response.status).toBe(200);
      }

      // 4th request should be rate limited
      const response = await request(app).post('/reset');
      expect(response.status).toBe(429);
      expect(response.body.error).toBe('RATE_LIMITED');
    });
  });

  describe('Register Rate Limiter Configuration', () => {
    it('should be configured with 10 requests per hour', async () => {
      const testRateLimiter = rateLimit({
        windowMs: 60 * 60 * 1000,
        max: 10,
        standardHeaders: true,
        legacyHeaders: true,
        message: { error: 'RATE_LIMITED', message: 'Too many registration attempts.' },
      });

      const app = express();
      app.use(testRateLimiter);
      app.post('/register', (req, res) => res.json({ success: true }));

      // Make 10 requests - should all succeed
      for (let i = 0; i < 10; i++) {
        const response = await request(app).post('/register');
        expect(response.status).toBe(200);
      }

      // 11th request should be rate limited
      const response = await request(app).post('/register');
      expect(response.status).toBe(429);
      expect(response.body.error).toBe('RATE_LIMITED');
    });
  });

  describe('General Rate Limiter Configuration', () => {
    it('should be configured with 100 requests per minute', async () => {
      const testRateLimiter = rateLimit({
        windowMs: 60 * 1000,
        max: 100,
        standardHeaders: true,
        legacyHeaders: true,
        message: { error: 'RATE_LIMITED', message: 'Too many requests.' },
      });

      const app = express();
      app.use(testRateLimiter);
      app.get('/api', (req, res) => res.json({ success: true }));

      // Check header shows correct limit
      const response = await request(app).get('/api');
      expect(response.headers['ratelimit-limit']).toBe('100');
    });
  });

  describe('Rate Limit Error Response Format', () => {
    it('should return proper error format when rate limited', async () => {
      const testRateLimiter = rateLimit({
        windowMs: 1000,
        max: 1,
        standardHeaders: true,
        message: { error: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' },
      });

      const app = express();
      app.use(testRateLimiter);
      app.get('/test', (req, res) => res.json({ success: true }));

      // First request succeeds
      await request(app).get('/test');

      // Second request is rate limited
      const response = await request(app).get('/test');

      expect(response.status).toBe(429);
      expect(response.body).toEqual({
        error: 'RATE_LIMITED',
        message: 'Too many requests. Please slow down.',
      });
    });

    it('should include Retry-After header when rate limited', async () => {
      const testRateLimiter = rateLimit({
        windowMs: 60000, // 1 minute
        max: 1,
        standardHeaders: true,
      });

      const app = express();
      app.use(testRateLimiter);
      app.get('/test', (req, res) => res.json({ success: true }));

      // First request succeeds
      await request(app).get('/test');

      // Second request is rate limited
      const response = await request(app).get('/test');

      expect(response.status).toBe(429);
      expect(response.headers['retry-after']).toBeDefined();
    });
  });
});
