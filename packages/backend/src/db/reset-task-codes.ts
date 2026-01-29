/**
 * Reset task codes script - clears existing task codes, rates, and related data.
 * Run before re-seeding with updated rate card.
 *
 * DESTRUCTIVE: This will delete timesheet entries, compliance logs, and payroll records
 * that reference the task codes.
 */

import { db, schema } from './index.js';

const { taskCodes, taskCodeRates, timesheetEntries, complianceCheckLogs, payrollRecords, timesheets } =
  schema;

async function resetTaskCodes() {
  console.log('===========================================');
  console.log('RESET TASK CODES (FULL)');
  console.log('===========================================');
  console.log('');

  const args = process.argv.slice(2);
  if (!args.includes('--confirm')) {
    console.log('This will DELETE:');
    console.log('- All timesheet entries');
    console.log('- All compliance check logs');
    console.log('- All payroll records');
    console.log('- All timesheets');
    console.log('- All task code rates');
    console.log('- All task codes');
    console.log('');
    console.log('Run with --confirm to proceed.');
    process.exit(0);
  }

  console.log('Deleting compliance check logs...');
  await db.delete(complianceCheckLogs);
  console.log('Done.');

  console.log('Deleting payroll records...');
  await db.delete(payrollRecords);
  console.log('Done.');

  console.log('Deleting timesheet entries...');
  await db.delete(timesheetEntries);
  console.log('Done.');

  console.log('Deleting timesheets...');
  await db.delete(timesheets);
  console.log('Done.');

  console.log('Deleting task code rates...');
  await db.delete(taskCodeRates);
  console.log('Done.');

  console.log('Deleting task codes...');
  await db.delete(taskCodes);
  console.log('Done.');

  console.log('');
  console.log('===========================================');
  console.log('RESET COMPLETE');
  console.log('===========================================');
  console.log('');
  console.log('You can now run: npm run db:seed:production -- --confirm');
  console.log('');

  process.exit(0);
}

resetTaskCodes().catch((error) => {
  console.error('');
  console.error('RESET FAILED:', error);
  console.error('');
  process.exit(1);
});
