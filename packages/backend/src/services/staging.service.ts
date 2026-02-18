/**
 * Staging Service
 *
 * Aggregates approved timesheet entries by fund and writes staging_records
 * to the financial-system database. Also writes local staging_sync_status
 * records for tracking.
 *
 * Called during the approval flow — if staging write fails, the error
 * surfaces to the supervisor (but does NOT block the approval itself).
 *
 * Design:
 *   - One staging_records row per fund per timesheet
 *   - source_record_id = `ts_{timesheetId}_fund_{fundId}`
 *   - Unique constraint on (source_app, source_record_id) prevents duplicates
 *   - NULL fund_id entries default to fund_id = 1 (General Fund - Unrestricted)
 */

import { eq, and } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { financialDb, stagingRecords } from '../db/financial-system.js';
import type { StagingMetadata } from '@renewal/types';
import Decimal from 'decimal.js';

type DecimalValue = InstanceType<typeof Decimal>;

const { stagingSyncStatus } = schema;

// Default fund for entries without a fund_id
const DEFAULT_FUND_ID = 1; // General Fund (Unrestricted) in financial-system

// ─── Types ──────────────────────────────────────────────────────────

export type StagingErrorCode =
  | 'FINANCIAL_DB_NOT_CONFIGURED'
  | 'TIMESHEET_NOT_FOUND'
  | 'TIMESHEET_NOT_APPROVED'
  | 'NO_ENTRIES'
  | 'STAGING_INSERT_FAILED'
  | 'DUPLICATE_SUBMISSION';

export class StagingError extends Error {
  constructor(
    message: string,
    public code: StagingErrorCode
  ) {
    super(message);
    this.name = 'StagingError';
  }
}

interface FundAggregation {
  fundId: number;
  regularHours: DecimalValue;
  overtimeHours: DecimalValue;
  regularEarnings: DecimalValue;
  overtimeEarnings: DecimalValue;
  totalAmount: DecimalValue;
}

export interface StagingSubmitResult {
  submitted: number;
  records: Array<{
    sourceRecordId: string;
    fundId: number;
    amount: string;
  }>;
}

// ─── Service Functions ──────────────────────────────────────────────

/**
 * Submit staging records for an approved timesheet.
 *
 * Aggregates entries by fund_id, calculates earnings per fund,
 * and INSERTs one staging_records row per fund into financial-system.
 * Also writes local staging_sync_status records.
 *
 * This function is idempotent — the unique constraint on
 * (source_app, source_record_id) prevents duplicate writes.
 */
export async function submitStagingRecords(
  timesheetId: string
): Promise<StagingSubmitResult> {
  if (!financialDb) {
    throw new StagingError(
      'Financial system database not configured',
      'FINANCIAL_DB_NOT_CONFIGURED'
    );
  }

  // Load timesheet with entries and task codes
  const timesheet = await db.query.timesheets.findFirst({
    where: eq(schema.timesheets.id, timesheetId),
    with: {
      entries: {
        with: {
          taskCode: true,
        },
      },
    },
  });

  if (!timesheet) {
    throw new StagingError('Timesheet not found', 'TIMESHEET_NOT_FOUND');
  }

  if (timesheet.status !== 'approved') {
    throw new StagingError(
      `Cannot submit staging for timesheet with status: ${timesheet.status}`,
      'TIMESHEET_NOT_APPROVED'
    );
  }

  if (timesheet.entries.length === 0) {
    throw new StagingError('Timesheet has no entries', 'NO_ENTRIES');
  }

  // Check for existing staging records (idempotency)
  const existingSync = await db.query.stagingSyncStatus.findFirst({
    where: eq(stagingSyncStatus.timesheetId, timesheetId),
  });

  if (existingSync) {
    throw new StagingError(
      `Staging records already submitted for timesheet ${timesheetId}`,
      'DUPLICATE_SUBMISSION'
    );
  }

  // Resolve the employee's Zitadel ID for cross-system identity
  const employee = await db.query.employees.findFirst({
    where: eq(schema.employees.id, timesheet.employeeId),
    columns: { zitadelId: true },
  });

  if (!employee?.zitadelId) {
    throw new StagingError(
      `Employee ${timesheet.employeeId} has no Zitadel ID — cannot submit staging records`,
      'STAGING_INSERT_FAILED'
    );
  }

  const zitadelEmployeeId = employee.zitadelId;

  // Get payroll record for earnings data
  const payrollRecord = await db.query.payrollRecords.findFirst({
    where: eq(schema.payrollRecords.timesheetId, timesheetId),
  });

  // Aggregate entries by fund
  const fundMap = new Map<number, FundAggregation>();

  for (const entry of timesheet.entries) {
    const fundId = entry.fundId ?? DEFAULT_FUND_ID;
    const hours = new Decimal(entry.hours);

    let agg = fundMap.get(fundId);
    if (!agg) {
      agg = {
        fundId,
        regularHours: new Decimal(0),
        overtimeHours: new Decimal(0),
        regularEarnings: new Decimal(0),
        overtimeEarnings: new Decimal(0),
        totalAmount: new Decimal(0),
      };
      fundMap.set(fundId, agg);
    }

    agg.regularHours = agg.regularHours.plus(hours);
  }

  // Distribute payroll earnings across funds pro-rata by hours
  if (payrollRecord) {
    const totalRegularHours = Array.from(fundMap.values()).reduce(
      (sum, agg) => sum.plus(agg.regularHours),
      new Decimal(0)
    );

    const totalRegularEarnings = new Decimal(payrollRecord.agriculturalEarnings)
      .plus(new Decimal(payrollRecord.nonAgriculturalEarnings));
    const totalOvertimeEarnings = new Decimal(payrollRecord.overtimeEarnings);
    const totalOvertimeHours = new Decimal(payrollRecord.overtimeHours);
    const totalEarnings = new Decimal(payrollRecord.totalEarnings);

    if (totalRegularHours.greaterThan(0)) {
      // Distribute pro-rata by hours
      let allocatedEarnings = new Decimal(0);
      const fundEntries = Array.from(fundMap.values());

      for (let i = 0; i < fundEntries.length; i++) {
        const agg = fundEntries[i]!;
        const ratio = agg.regularHours.dividedBy(totalRegularHours);

        if (i === fundEntries.length - 1) {
          // Last fund gets remainder to avoid rounding errors
          agg.regularEarnings = totalRegularEarnings.minus(allocatedEarnings);
          agg.overtimeEarnings = totalOvertimeEarnings.minus(
            fundEntries.slice(0, -1).reduce((s, a) => s.plus(a.overtimeEarnings), new Decimal(0))
          );
          agg.overtimeHours = totalOvertimeHours.minus(
            fundEntries.slice(0, -1).reduce((s, a) => s.plus(a.overtimeHours), new Decimal(0))
          );
        } else {
          agg.regularEarnings = totalRegularEarnings.times(ratio);
          agg.overtimeEarnings = totalOvertimeEarnings.times(ratio);
          agg.overtimeHours = totalOvertimeHours.times(ratio);
          allocatedEarnings = allocatedEarnings.plus(agg.regularEarnings);
        }

        agg.totalAmount = agg.regularEarnings.plus(agg.overtimeEarnings);
      }
    } else {
      // 0-hour timesheet — all earnings go to General Fund
      const generalFund = fundMap.get(DEFAULT_FUND_ID) ?? {
        fundId: DEFAULT_FUND_ID,
        regularHours: new Decimal(0),
        overtimeHours: new Decimal(0),
        regularEarnings: new Decimal(0),
        overtimeEarnings: new Decimal(0),
        totalAmount: new Decimal(0),
      };
      generalFund.regularEarnings = totalEarnings;
      generalFund.totalAmount = totalEarnings;
      fundMap.set(DEFAULT_FUND_ID, generalFund);
    }
  }

  // Calculate pay period end date
  const periodEndDate = new Date(timesheet.weekStartDate + 'T00:00:00');
  periodEndDate.setDate(periodEndDate.getDate() + 6);
  const dateIncurred = periodEndDate.toISOString().split('T')[0]!;

  // Build staging record rows
  const stagingRows = Array.from(fundMap.values()).map((agg) => {
    const sourceRecordId = `ts_${timesheetId}_fund_${agg.fundId}`;
    const metadata: StagingMetadata = {
      regularHours: agg.regularHours.toFixed(2),
      overtimeHours: agg.overtimeHours.toFixed(2),
      regularEarnings: agg.regularEarnings.toFixed(2),
      overtimeEarnings: agg.overtimeEarnings.toFixed(2),
    };

    return {
      sourceApp: 'timesheets' as const,
      sourceRecordId,
      recordType: 'timesheet_fund_summary' as const,
      employeeId: zitadelEmployeeId,
      referenceId: timesheetId,
      dateIncurred,
      amount: agg.totalAmount.toFixed(2),
      fundId: agg.fundId,
      glAccountId: null as number | null,
      metadata,
      status: 'received' as const,
    };
  });

  // INSERT into financial-system staging_records
  try {
    await financialDb.insert(stagingRecords).values(stagingRows);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    // Check for unique constraint violation (duplicate submission)
    if (message.includes('uq_staging_source') || message.includes('unique constraint')) {
      throw new StagingError(
        `Staging records already exist for timesheet ${timesheetId}`,
        'DUPLICATE_SUBMISSION'
      );
    }

    throw new StagingError(
      `Failed to insert staging records: ${message}`,
      'STAGING_INSERT_FAILED'
    );
  }

  // Write local staging_sync_status records
  const syncRows = stagingRows.map((row) => ({
    timesheetId,
    sourceRecordId: row.sourceRecordId,
    fundId: row.fundId,
    amount: row.amount,
    status: 'received' as const,
    metadata: row.metadata as unknown as Record<string, unknown>,
  }));

  await db.insert(stagingSyncStatus).values(syncRows);

  return {
    submitted: stagingRows.length,
    records: stagingRows.map((r) => ({
      sourceRecordId: r.sourceRecordId,
      fundId: r.fundId,
      amount: r.amount,
    })),
  };
}

/**
 * Get the financial status of a timesheet from local sync records.
 */
export async function getTimesheetStagingStatus(
  timesheetId: string
): Promise<{
  records: Array<{
    id: string;
    sourceRecordId: string;
    fundId: number;
    amount: string;
    status: string;
    syncedAt: string;
    lastCheckedAt: string | null;
    metadata: unknown;
  }>;
  allPosted: boolean;
}> {
  const records = await db.query.stagingSyncStatus.findMany({
    where: eq(stagingSyncStatus.timesheetId, timesheetId),
  });

  const mapped = records.map((r) => ({
    id: r.id,
    sourceRecordId: r.sourceRecordId,
    fundId: r.fundId,
    amount: r.amount,
    status: r.status,
    syncedAt: r.syncedAt.toISOString(),
    lastCheckedAt: r.lastCheckedAt?.toISOString() ?? null,
    metadata: r.metadata,
  }));

  const allPosted = mapped.length > 0 && mapped.every((r) => r.status !== 'received');

  return { records: mapped, allPosted };
}

/**
 * Refresh staging status from financial-system.
 * Reads current status from staging_records and updates local sync records.
 */
export async function refreshStagingStatus(timesheetId: string): Promise<void> {
  if (!financialDb) return;

  const localRecords = await db.query.stagingSyncStatus.findMany({
    where: eq(stagingSyncStatus.timesheetId, timesheetId),
  });

  if (localRecords.length === 0) return;

  for (const local of localRecords) {
    // Read status from financial-system
    const [remote] = await financialDb
      .select({ status: stagingRecords.status, errorMessage: stagingRecords.errorMessage })
      .from(stagingRecords)
      .where(
        and(
          eq(stagingRecords.sourceApp, 'timesheets'),
          eq(stagingRecords.sourceRecordId, local.sourceRecordId)
        )
      )
      .limit(1);

    if (remote && remote.status !== local.status) {
      await db
        .update(stagingSyncStatus)
        .set({
          status: remote.status,
          lastCheckedAt: new Date(),
        })
        .where(eq(stagingSyncStatus.id, local.id));
    } else {
      // Update last_checked_at even if status unchanged
      await db
        .update(stagingSyncStatus)
        .set({ lastCheckedAt: new Date() })
        .where(eq(stagingSyncStatus.id, local.id));
    }
  }
}
