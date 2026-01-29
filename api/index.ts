/**
 * Vercel Serverless Function Entry Point
 *
 * This file serves as the entry point for the Express backend when deployed
 * to Vercel. It imports the pre-compiled Express app from packages/backend/dist.
 *
 * How it works:
 * - Locally: This file is NOT used. Vite proxies /api/* to localhost:3001
 * - Production: Vercel builds the backend first (via buildCommand), then
 *   bundles this file which imports the compiled JS from dist/
 *
 * The source code lives in packages/backend/src/app.ts
 * The compiled output is packages/backend/dist/app.js
 */

import app from '../packages/backend/dist/app.js';

export default app;
