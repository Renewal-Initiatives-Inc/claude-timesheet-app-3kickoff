/**
 * Migration and data purge script for Phase 7 Zitadel integration.
 * Run with: node scripts/migrate-and-purge.mjs
 */
import pg from 'pg';

const { Client } = pg;

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Step 1: Add zitadel_id column if it doesn't exist
    console.log('\n--- Running migration: Add zitadel_id column ---');
    await client.query(`
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS zitadel_id VARCHAR(255) UNIQUE;
    `);
    console.log('Added zitadel_id column');

    // Create index
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_employees_zitadel_id ON employees(zitadel_id);
    `);
    console.log('Created index on zitadel_id');

    // Step 2: Purge all test data
    console.log('\n--- Purging test data ---');

    // Delete in order respecting foreign key constraints
    const tables = [
      'payroll_records',
      'compliance_check_logs',
      'compliance_alerts',
      'timesheet_entries',
      'timesheets',
      'task_code_rates',
      'task_codes',
      'employee_documents',
      'sessions',
      'employees',
    ];

    for (const table of tables) {
      try {
        const result = await client.query(`DELETE FROM ${table}`);
        console.log(`Deleted ${result.rowCount} rows from ${table}`);
      } catch (err) {
        // Table might not exist or no rows
        console.log(`Skipped ${table}: ${err.message}`);
      }
    }

    console.log('\n--- Migration and purge complete ---');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
