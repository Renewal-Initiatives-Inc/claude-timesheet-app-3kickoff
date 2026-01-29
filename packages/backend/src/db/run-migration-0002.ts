/**
 * Run migration 0002 - Add requires_password_change column
 *
 * Usage:
 *   npm run db:migrate-0002 -w @renewal/backend
 *
 * Or with tsx directly:
 *   cd packages/backend && npx tsx --env-file=../../.env.local src/db/run-migration-0002.ts
 */

import { sql } from 'drizzle-orm';
import { db } from './index.js';

async function runMigration() {
  console.log('Running migration 0002: Add requires_password_change column...');

  try {
    // Check if column already exists
    const result = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'employees'
        AND column_name = 'requires_password_change'
    `);

    if (result.rows.length > 0) {
      console.log('Column requires_password_change already exists. Skipping migration.');
      process.exit(0);
    }

    // Add the column
    await db.execute(sql`
      ALTER TABLE employees
      ADD COLUMN requires_password_change BOOLEAN NOT NULL DEFAULT false
    `);

    console.log('Migration 0002 completed successfully!');
    console.log('Column requires_password_change added to employees table.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
