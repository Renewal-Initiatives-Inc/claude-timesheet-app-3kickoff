/**
 * Fix task code rate effective dates and recalculate payroll.
 *
 * This script fixes a bug where task_code_rates were created with
 * effective_date = today, making them invalid for work dates before
 * the seed was run.
 *
 * It will:
 * 1. Update all task_code_rates to have effective_date = '2020-01-01'
 * 2. Recalculate payroll for all approved timesheets
 *
 * USAGE:
 *   npx tsx src/db/fix-rate-effective-dates.ts --confirm
 */

import { eq } from 'drizzle-orm';
import { db, schema } from './index.js';
import { calculatePayrollForTimesheet } from '../services/payroll.service.js';

const { taskCodeRates, timesheets, payrollRecords } = schema;

const BACKDATE_TO = '2020-01-01';

async function fixRateEffectiveDates() {
  console.log('===========================================');
  console.log('FIX TASK CODE RATE EFFECTIVE DATES');
  console.log('===========================================');
  console.log('');

  const args = process.argv.slice(2);
  if (!args.includes('--confirm')) {
    console.log('This script will:');
    console.log(`1. Update all task_code_rates effective_date to ${BACKDATE_TO}`);
    console.log('2. Delete existing payroll records');
    console.log('3. Recalculate payroll for all approved timesheets');
    console.log('');
    console.log('Run with --confirm to proceed.');
    process.exit(0);
  }

  // Step 1: Update all effective dates
  console.log(`Step 1: Updating task_code_rates effective_date to ${BACKDATE_TO}...`);
  const ratesResult = await db
    .update(taskCodeRates)
    .set({ effectiveDate: BACKDATE_TO })
    .returning();
  console.log(`  Updated ${ratesResult.length} rate records`);

  // Step 2: Get all approved timesheets
  console.log('');
  console.log('Step 2: Finding approved timesheets...');
  const approvedTimesheets = await db
    .select({ id: timesheets.id, weekStartDate: timesheets.weekStartDate })
    .from(timesheets)
    .where(eq(timesheets.status, 'approved'));
  console.log(`  Found ${approvedTimesheets.length} approved timesheets`);

  if (approvedTimesheets.length === 0) {
    console.log('');
    console.log('No approved timesheets to process.');
    process.exit(0);
  }

  // Step 3: Delete existing payroll records
  console.log('');
  console.log('Step 3: Clearing existing payroll records...');
  const deleteResult = await db.delete(payrollRecords).returning();
  console.log(`  Deleted ${deleteResult.length} payroll records`);

  // Step 4: Recalculate payroll for each approved timesheet
  console.log('');
  console.log('Step 4: Recalculating payroll...');
  let successCount = 0;
  let errorCount = 0;

  for (const ts of approvedTimesheets) {
    try {
      const payroll = await calculatePayrollForTimesheet(ts.id);
      console.log(`  ✓ ${ts.weekStartDate}: $${payroll.totalEarnings}`);
      successCount++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  ✗ ${ts.weekStartDate}: ${message}`);
      errorCount++;
    }
  }

  console.log('');
  console.log('===========================================');
  console.log('FIX COMPLETED');
  console.log('===========================================');
  console.log('');
  console.log('Summary:');
  console.log(`- Rates updated: ${ratesResult.length}`);
  console.log(`- Payroll calculated successfully: ${successCount}`);
  console.log(`- Payroll calculation errors: ${errorCount}`);
  console.log('');

  process.exit(errorCount > 0 ? 1 : 0);
}

fixRateEffectiveDates().catch((error) => {
  console.error('');
  console.error('FIX FAILED:', error);
  console.error('');
  process.exit(1);
});
