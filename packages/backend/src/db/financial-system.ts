/**
 * Drizzle client and table schemas for the financial-system database.
 *
 * Connection uses the `timesheets_role` Postgres role with:
 *   - SELECT on `funds`, `accounts`
 *   - INSERT + SELECT on `staging_records`
 *
 * These table definitions are NOT managed by this app's migrations —
 * they exist solely for type-safe query building.
 */

import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  boolean,
  numeric,
  date,
  timestamp,
  jsonb,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

const { Pool } = pg;

// ─── External Table Schemas ────────────────────────────────────────

export const funds = pgTable('funds', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  fundCode: varchar('fund_code', { length: 20 }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
});

export const accounts = pgTable('accounts', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  accountCode: varchar('account_code', { length: 20 }).notNull(),
  accountType: varchar('account_type', { length: 50 }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
});

export const stagingRecords = pgTable(
  'staging_records',
  {
    id: serial('id').primaryKey(),
    sourceApp: varchar('source_app', { length: 50 }).notNull(),
    sourceRecordId: varchar('source_record_id', { length: 255 }).notNull(),
    recordType: varchar('record_type', { length: 50 }).notNull(),
    employeeId: varchar('employee_id', { length: 255 }),
    referenceId: varchar('reference_id', { length: 255 }),
    dateIncurred: date('date_incurred'),
    amount: numeric('amount', { precision: 12, scale: 2 }),
    fundId: integer('fund_id'),
    glAccountId: integer('gl_account_id'),
    metadata: jsonb('metadata'),
    status: varchar('status', { length: 20 }).notNull().default('received'),
    errorMessage: text('error_message'),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_staging_source').on(table.sourceApp, table.sourceRecordId),
  ]
);

// Schema bundle for the Drizzle client
const financialSchema = { funds, accounts, stagingRecords };

// ─── Database Client ───────────────────────────────────────────────

const isVercel = process.env['VERCEL'] === '1';
const nodeEnv = process.env['NODE_ENV'];

function createFinancialSystemDb() {
  const connectionString = process.env['FINANCIAL_SYSTEM_DATABASE_URL'];

  if (!connectionString) {
    // Graceful: return null so the app can start without this DB configured
    return null;
  }

  const isLocal =
    nodeEnv === 'development' || nodeEnv === 'test' || connectionString.includes('localhost');

  if (isVercel && !isLocal) {
    const sql = neon(connectionString);
    return drizzleNeon(sql, { schema: financialSchema });
  }

  const pool = new Pool({
    connectionString,
    max: 3, // Low pool — cross-DB reads are infrequent
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  return drizzlePg({ client: pool, schema: financialSchema });
}

export const financialDb = createFinancialSystemDb();
