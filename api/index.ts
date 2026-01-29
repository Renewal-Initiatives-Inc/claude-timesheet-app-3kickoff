/**
 * Vercel Serverless Function Entry Point
 * Routes all /api/* requests to the Express backend
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Dynamic import to catch any module load errors
let app: ((req: VercelRequest, res: VercelResponse) => void) | null = null;
let loadError: Error | null = null;

async function loadApp() {
  if (app) return app;
  if (loadError) throw loadError;

  try {
    const module = await import('../packages/backend/dist/app.js');
    app = module.default;
    return app;
  } catch (error) {
    loadError = error as Error;
    throw error;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const expressApp = await loadApp();
    return expressApp(req, res);
  } catch (error) {
    const err = error as Error;
    return res.status(500).json({
      error: 'Failed to load backend application',
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
}
