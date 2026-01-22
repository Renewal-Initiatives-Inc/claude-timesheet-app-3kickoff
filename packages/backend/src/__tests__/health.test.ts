import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app.js';

describe('GET /api/health', () => {
  it('returns 200 status', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
  });

  it('returns correct response shape', async () => {
    const response = await request(app).get('/api/health');
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('timestamp');
  });

  it('returns valid ISO8601 timestamp', async () => {
    const response = await request(app).get('/api/health');
    const timestamp = response.body.timestamp;
    const parsed = new Date(timestamp);
    expect(parsed.toISOString()).toBe(timestamp);
  });
});
