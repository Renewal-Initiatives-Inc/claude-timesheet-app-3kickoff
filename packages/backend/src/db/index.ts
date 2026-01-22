import { drizzle as drizzleVercel } from 'drizzle-orm/vercel-postgres';
import { sql } from '@vercel/postgres';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema/index.js';

const { Pool } = pg;

// Determine if running locally or in Vercel
const isVercel = process.env['VERCEL'] === '1';
const nodeEnv = process.env['NODE_ENV'];
const databaseUrl = process.env['DATABASE_URL'];
const isLocal = nodeEnv === 'development' || nodeEnv === 'test' || databaseUrl?.includes('localhost');

// Create appropriate database client
function createDb() {
  // Production on Vercel: use Vercel Postgres adapter
  if (isVercel && !isLocal) {
    return drizzleVercel({
      client: sql,
      schema,
    });
  }

  // Local development or tests: use pg Pool with connection pooling
  const connectionString = databaseUrl;

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  return drizzlePg({
    client: pool,
    schema,
  });
}

export const db = createDb();
export { schema };
