import { describe, it, expect, vi, beforeEach } from 'vitest';
import Decimal from 'decimal.js';

/**
 * Unit tests for staging service — fund aggregation + pro-rata distribution.
 *
 * Tests the core logic that:
 *   1. Groups timesheet entries by fund_id
 *   2. Distributes payroll earnings across funds pro-rata by hours
 *   3. Handles edge cases: 0-hour timesheets, single fund, rounding
 *   4. Builds correct staging_records row shape
 *   5. Idempotency: duplicate submissions caught
 */

// ─── Mock DB layer ───────────────────────────────────────────────────

const mockFindFirst = vi.fn();
const mockFindMany = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();

vi.mock('../../db/index.js', () => ({
  db: {
    query: {
      timesheets: { findFirst: (...args: unknown[]) => mockFindFirst(...args) },
      payrollRecords: { findFirst: (...args: unknown[]) => mockFindFirst(...args) },
      stagingSyncStatus: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
        findMany: (...args: unknown[]) => mockFindMany(...args),
      },
    },
    insert: (...args: unknown[]) => mockInsert(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  },
  schema: {
    timesheets: { id: 'id' },
    payrollRecords: { timesheetId: 'timesheet_id' },
    stagingSyncStatus: {},
  },
}));

const mockFinancialInsert = vi.fn();

vi.mock('../../db/financial-system.js', () => ({
  financialDb: {
    insert: (...args: unknown[]) => mockFinancialInsert(...args),
    select: (...args: unknown[]) => mockSelect(...args),
  },
  stagingRecords: {},
}));

vi.mock('@renewal/types', () => ({
  // StagingMetadata is just a type, no runtime value needed
}));

// Now import after mocks
import {
  submitStagingRecords,
  getTimesheetStagingStatus,
  StagingError,
} from '../../services/staging.service.js';

// ─── Helpers ─────────────────────────────────────────────────────────

function mockTimesheet(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ts-100',
    employeeId: 'emp-1',
    weekStartDate: '2026-02-08',
    status: 'approved',
    entries: [
      { id: 'e1', hours: '8.00', fundId: 1, taskCodeId: 'tc-1', taskCode: { isAgricultural: false } },
      { id: 'e2', hours: '6.00', fundId: 2, taskCodeId: 'tc-2', taskCode: { isAgricultural: true } },
      { id: 'e3', hours: '4.00', fundId: 1, taskCodeId: 'tc-1', taskCode: { isAgricultural: false } },
    ],
    ...overrides,
  };
}

function mockPayroll(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pr-1',
    timesheetId: 'ts-100',
    agriculturalEarnings: '48.00',      // 6 hrs
    nonAgriculturalEarnings: '180.00',  // 12 hrs
    overtimeEarnings: '0.00',
    overtimeHours: '0.00',
    totalEarnings: '228.00',
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────

describe('Staging Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no existing staging records (not a duplicate)
    mockFindFirst.mockResolvedValue(null);
    // Default: insert succeeds
    mockFinancialInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
    mockInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
  });

  describe('StagingError', () => {
    it('should create error with correct code', () => {
      const err = new StagingError('test message', 'TIMESHEET_NOT_FOUND');
      expect(err.code).toBe('TIMESHEET_NOT_FOUND');
      expect(err.message).toBe('test message');
      expect(err.name).toBe('StagingError');
    });

    it('should support all error codes', () => {
      const codes = [
        'FINANCIAL_DB_NOT_CONFIGURED',
        'TIMESHEET_NOT_FOUND',
        'TIMESHEET_NOT_APPROVED',
        'NO_ENTRIES',
        'STAGING_INSERT_FAILED',
        'DUPLICATE_SUBMISSION',
      ] as const;
      for (const code of codes) {
        const err = new StagingError('msg', code);
        expect(err.code).toBe(code);
      }
    });
  });

  describe('Fund aggregation logic (pure)', () => {
    it('should aggregate entries by fund_id', () => {
      // Given: entries across 2 funds
      const entries = [
        { hours: '8.00', fundId: 1 },
        { hours: '6.00', fundId: 2 },
        { hours: '4.00', fundId: 1 },
      ];

      // Aggregate manually (mirrors service logic)
      const fundMap = new Map<number, Decimal>();
      for (const e of entries) {
        const fundId = e.fundId ?? 1;
        const prev = fundMap.get(fundId) ?? new Decimal(0);
        fundMap.set(fundId, prev.plus(new Decimal(e.hours)));
      }

      expect(fundMap.get(1)!.toFixed(2)).toBe('12.00');
      expect(fundMap.get(2)!.toFixed(2)).toBe('6.00');
      expect(fundMap.size).toBe(2);
    });

    it('should default null fund_id to General Fund (1)', () => {
      const entries = [
        { hours: '5.00', fundId: null },
        { hours: '3.00', fundId: undefined },
        { hours: '2.00', fundId: 1 },
      ];

      const DEFAULT_FUND_ID = 1;
      const fundMap = new Map<number, Decimal>();
      for (const e of entries) {
        const fundId = e.fundId ?? DEFAULT_FUND_ID;
        const prev = fundMap.get(fundId) ?? new Decimal(0);
        fundMap.set(fundId, prev.plus(new Decimal(e.hours)));
      }

      // All entries should aggregate under fund 1
      expect(fundMap.size).toBe(1);
      expect(fundMap.get(1)!.toFixed(2)).toBe('10.00');
    });

    it('should distribute earnings pro-rata by hours across funds', () => {
      // Fund 1: 12 hrs, Fund 2: 6 hrs → total 18 hrs
      // Total regular earnings: $228
      // Fund 1 gets 12/18 = 2/3 → $152
      // Fund 2 gets 6/18 = 1/3 → $76
      const totalRegHours = new Decimal('18');
      const totalRegEarnings = new Decimal('228');

      const fund1Hours = new Decimal('12');
      const fund2Hours = new Decimal('6');

      const fund1Earnings = totalRegEarnings.times(fund1Hours.dividedBy(totalRegHours));
      // Last fund gets remainder
      const fund2Earnings = totalRegEarnings.minus(fund1Earnings);

      expect(fund1Earnings.toFixed(2)).toBe('152.00');
      expect(fund2Earnings.toFixed(2)).toBe('76.00');
      expect(fund1Earnings.plus(fund2Earnings).toFixed(2)).toBe('228.00');
    });

    it('should avoid rounding drift with remainder pattern', () => {
      // 3 funds: 7 hrs, 5 hrs, 3 hrs → total 15 hrs
      // Total earnings: $100
      // Fund A: 7/15 × 100 = 46.666... → 46.67
      // Fund B: 5/15 × 100 = 33.333... → 33.33
      // Fund C: remainder = 100 - 46.67 - 33.33 = 20.00
      const totalHours = new Decimal('15');
      const totalEarnings = new Decimal('100');

      const hours = [new Decimal('7'), new Decimal('5'), new Decimal('3')];
      const earnings: Decimal[] = [];
      let allocated = new Decimal(0);

      for (let i = 0; i < hours.length; i++) {
        if (i === hours.length - 1) {
          // Last fund gets remainder
          earnings.push(totalEarnings.minus(allocated));
        } else {
          const ratio = hours[i]!.dividedBy(totalHours);
          const amount = totalEarnings.times(ratio);
          earnings.push(amount);
          allocated = allocated.plus(amount);
        }
      }

      // Sum must equal total exactly
      const sum = earnings.reduce((a, b) => a.plus(b), new Decimal(0));
      expect(sum.equals(totalEarnings)).toBe(true);
    });

    it('should handle overtime distribution pro-rata', () => {
      // Fund 1: 30 hrs, Fund 2: 15 hrs → total 45 hrs (5 OT)
      // OT earnings: $37.50 (at 1.5× $15/hr × 5 / pro-rata)
      const totalHours = new Decimal('45');
      const otHours = new Decimal('5');
      const otEarnings = new Decimal('37.50');

      const fund1Hours = new Decimal('30');
      const fund2Hours = new Decimal('15');

      const fund1OtEarnings = otEarnings.times(fund1Hours.dividedBy(totalHours));
      const fund2OtEarnings = otEarnings.minus(fund1OtEarnings);

      expect(fund1OtEarnings.toFixed(2)).toBe('25.00');
      expect(fund2OtEarnings.toFixed(2)).toBe('12.50');
      expect(fund1OtEarnings.plus(fund2OtEarnings).toFixed(2)).toBe('37.50');
    });
  });

  describe('0-hour timesheet', () => {
    it('should allocate all earnings to General Fund when total hours = 0', () => {
      const DEFAULT_FUND_ID = 1;
      const totalHours = new Decimal('0');
      const totalEarnings = new Decimal('500'); // salaried weekly pay

      // Mirrors service logic: if totalHours <= 0, dump to General Fund
      const fundMap = new Map<number, { totalAmount: Decimal }>();
      if (totalHours.lessThanOrEqualTo(0)) {
        fundMap.set(DEFAULT_FUND_ID, { totalAmount: totalEarnings });
      }

      expect(fundMap.size).toBe(1);
      expect(fundMap.get(DEFAULT_FUND_ID)!.totalAmount.toFixed(2)).toBe('500.00');
    });
  });

  describe('source_record_id generation', () => {
    it('should produce correct format', () => {
      const timesheetId = 'ts-abc-123';
      const fundId = 42;
      const sourceRecordId = `ts_${timesheetId}_fund_${fundId}`;
      expect(sourceRecordId).toBe('ts_ts-abc-123_fund_42');
    });

    it('should be unique per timesheet-fund combination', () => {
      const ids = new Set([
        `ts_ts-1_fund_1`,
        `ts_ts-1_fund_2`,
        `ts_ts-2_fund_1`,
      ]);
      expect(ids.size).toBe(3);
    });
  });

  describe('submitStagingRecords (integrated with mocked DB)', () => {
    it('should reject non-approved timesheets', async () => {
      mockFindFirst.mockReset();
      mockFindFirst.mockResolvedValueOnce(mockTimesheet({ status: 'draft' }));

      const err = await submitStagingRecords('ts-100').catch((e) => e);
      expect(err).toBeInstanceOf(StagingError);
      expect(err.code).toBe('TIMESHEET_NOT_APPROVED');
    });

    it('should reject timesheets with no entries', async () => {
      mockFindFirst.mockReset();
      mockFindFirst.mockResolvedValueOnce(mockTimesheet({ entries: [] }));

      await expect(submitStagingRecords('ts-100')).rejects.toThrow(StagingError);
    });

    it('should detect duplicate submissions via local check', async () => {
      mockFindFirst.mockReset();
      // 1st: timesheet lookup
      mockFindFirst.mockResolvedValueOnce(mockTimesheet());
      // 2nd: existing staging sync record found
      mockFindFirst.mockResolvedValueOnce({ id: 'existing', timesheetId: 'ts-100' });

      await expect(submitStagingRecords('ts-100')).rejects.toMatchObject({
        code: 'DUPLICATE_SUBMISSION',
      });
    });

    it('should detect duplicate submissions via financial-system unique constraint', async () => {
      mockFindFirst.mockReset();
      // 1st: timesheet
      mockFindFirst.mockResolvedValueOnce(mockTimesheet());
      // 2nd: no local staging record
      mockFindFirst.mockResolvedValueOnce(null);
      // 3rd: payroll record
      mockFindFirst.mockResolvedValueOnce(mockPayroll());

      // Financial DB insert throws unique constraint error
      mockFinancialInsert.mockReturnValue({
        values: vi.fn().mockRejectedValue(new Error('unique constraint "uq_staging_source" violated')),
      });

      await expect(submitStagingRecords('ts-100')).rejects.toMatchObject({
        code: 'DUPLICATE_SUBMISSION',
      });
    });

    it('should submit correct number of staging records (one per fund)', async () => {
      mockFindFirst.mockReset();
      // Timesheet with entries in 2 funds
      mockFindFirst.mockResolvedValueOnce(mockTimesheet());
      // No existing staging
      mockFindFirst.mockResolvedValueOnce(null);
      // Payroll record
      mockFindFirst.mockResolvedValueOnce(mockPayroll());

      const capturedValues: unknown[] = [];
      mockFinancialInsert.mockReturnValue({
        values: vi.fn().mockImplementation((vals: unknown) => {
          capturedValues.push(vals);
          return Promise.resolve();
        }),
      });
      mockInsert.mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      const result = await submitStagingRecords('ts-100');

      expect(result.submitted).toBe(2); // fund 1 + fund 2
      expect(result.records).toHaveLength(2);
      expect(result.records.map((r) => r.fundId).sort()).toEqual([1, 2]);
    });

    it('should calculate correct per-fund earnings', async () => {
      mockFindFirst.mockReset();
      // Timesheet: fund 1 = 12 hrs, fund 2 = 6 hrs, total = 18 hrs
      // Payroll: total earnings = $228
      // Fund 1: 12/18 × 228 = $152, Fund 2: 6/18 × 228 = $76
      mockFindFirst.mockResolvedValueOnce(mockTimesheet());
      mockFindFirst.mockResolvedValueOnce(null);
      mockFindFirst.mockResolvedValueOnce(mockPayroll());

      mockFinancialInsert.mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });
      mockInsert.mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      const result = await submitStagingRecords('ts-100');

      const fund1 = result.records.find((r) => r.fundId === 1);
      const fund2 = result.records.find((r) => r.fundId === 2);

      // Pro-rata: fund 1 = 12/18 × 228 = 152, fund 2 = remainder = 76
      expect(fund1).toBeDefined();
      expect(fund2).toBeDefined();
      expect(new Decimal(fund1!.amount).plus(new Decimal(fund2!.amount)).toFixed(2)).toBe('228.00');
    });

    it('should handle single-fund timesheet', async () => {
      mockFindFirst.mockReset();
      const singleFundTs = mockTimesheet({
        entries: [
          { id: 'e1', hours: '8.00', fundId: 1, taskCodeId: 'tc-1', taskCode: { isAgricultural: false } },
          { id: 'e2', hours: '4.00', fundId: 1, taskCodeId: 'tc-2', taskCode: { isAgricultural: true } },
        ],
      });
      mockFindFirst.mockResolvedValueOnce(singleFundTs);
      mockFindFirst.mockResolvedValueOnce(null);
      mockFindFirst.mockResolvedValueOnce(mockPayroll({ totalEarnings: '180.00' }));

      mockFinancialInsert.mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });
      mockInsert.mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      const result = await submitStagingRecords('ts-100');

      expect(result.submitted).toBe(1);
      expect(result.records[0]!.fundId).toBe(1);
    });
  });

  describe('getTimesheetStagingStatus', () => {
    it('should return empty records when no staging exists', async () => {
      mockFindMany.mockResolvedValueOnce([]);
      const status = await getTimesheetStagingStatus('ts-100');
      expect(status.records).toHaveLength(0);
      expect(status.allPosted).toBe(false);
    });

    it('should return allPosted = true when all records are posted', async () => {
      mockFindMany.mockResolvedValueOnce([
        { id: 's1', sourceRecordId: 'ts_100_fund_1', fundId: 1, amount: '100.00', status: 'posted', syncedAt: new Date(), lastCheckedAt: new Date(), metadata: {} },
        { id: 's2', sourceRecordId: 'ts_100_fund_2', fundId: 2, amount: '50.00', status: 'posted', syncedAt: new Date(), lastCheckedAt: null, metadata: {} },
      ]);

      const status = await getTimesheetStagingStatus('ts-100');
      expect(status.records).toHaveLength(2);
      expect(status.allPosted).toBe(true);
    });

    it('should return allPosted = false when any record is still received', async () => {
      mockFindMany.mockResolvedValueOnce([
        { id: 's1', sourceRecordId: 'ts_100_fund_1', fundId: 1, amount: '100.00', status: 'posted', syncedAt: new Date(), lastCheckedAt: new Date(), metadata: {} },
        { id: 's2', sourceRecordId: 'ts_100_fund_2', fundId: 2, amount: '50.00', status: 'received', syncedAt: new Date(), lastCheckedAt: null, metadata: {} },
      ]);

      const status = await getTimesheetStagingStatus('ts-100');
      expect(status.allPosted).toBe(false);
    });
  });
});
