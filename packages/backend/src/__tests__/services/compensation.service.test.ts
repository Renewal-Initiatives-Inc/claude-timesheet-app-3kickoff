import { describe, it, expect, vi, beforeEach } from 'vitest';
import Decimal from 'decimal.js';

/**
 * Unit tests for compensation service — PER_TASK vs SALARIED logic,
 * FLSA compliance, and graceful degradation.
 *
 * Tests cover:
 *   1. SALARIED: weekly pay = annual_salary / 52
 *   2. PER_TASK: returns null (caller falls back to task_code_rates)
 *   3. FLSA: EXEMPT classification requires salary >= $684/week
 *   4. Graceful degradation: null when portal DB unavailable
 *   5. Graceful degradation: null when employee has no zitadelId
 */

// ─── Mock DB layer ───────────────────────────────────────────────────

const mockLocalFindFirst = vi.fn();
const mockPortalSelect = vi.fn();

vi.mock('../../db/index.js', () => ({
  db: {
    query: {
      employees: {
        findFirst: (...args: unknown[]) => mockLocalFindFirst(...args),
      },
    },
  },
  schema: {
    employees: { id: 'id', zitadelId: 'zitadel_id' },
  },
}));

// Portal DB — start as configured (not null)
let mockPortalDb: object | null = {};

vi.mock('../../db/app-portal.js', () => ({
  get portalDb() {
    if (!mockPortalDb) return null;
    return {
      select: (...args: unknown[]) => mockPortalSelect(...args),
    };
  },
  portalEmployees: {
    id: 'id',
    compensationType: 'compensation_type',
    annualSalary: 'annual_salary',
    expectedAnnualHours: 'expected_annual_hours',
    exemptStatus: 'exempt_status',
    zitadelUserId: 'zitadel_user_id',
  },
}));

// Now import after mocks
import {
  getEmployeeCompensation,
  getSalariedWeeklyPay,
  CompensationError,
} from '../../services/compensation.service.js';

// ─── Helpers ─────────────────────────────────────────────────────────

function mockLocalEmployee(overrides: Record<string, unknown> = {}) {
  return {
    id: 'emp-1',
    zitadelId: 'zitadel-user-abc',
    ...overrides,
  };
}

function mockPortalEmployee(overrides: Record<string, unknown> = {}) {
  return {
    id: 'portal-emp-1',
    compensationType: 'SALARIED',
    annualSalary: '52000.00',
    expectedAnnualHours: 2080,
    exemptStatus: 'NON_EXEMPT',
    ...overrides,
  };
}

/** Set up the fluent chain: portalDb.select().from().where().limit() */
function setupPortalSelect(result: unknown[]) {
  mockPortalSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(result),
      }),
    }),
  });
}

// ─── Tests ───────────────────────────────────────────────────────────

describe('Compensation Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPortalDb = {}; // configured
  });

  describe('CompensationError', () => {
    it('should create error with correct code', () => {
      const err = new CompensationError('test', 'EMPLOYEE_NOT_FOUND');
      expect(err.code).toBe('EMPLOYEE_NOT_FOUND');
      expect(err.name).toBe('CompensationError');
    });
  });

  describe('getEmployeeCompensation', () => {
    it('should return null when portal DB is not configured', async () => {
      mockPortalDb = null;
      const result = await getEmployeeCompensation('emp-1');
      expect(result).toBeNull();
    });

    it('should throw when local employee not found', async () => {
      mockLocalFindFirst.mockResolvedValueOnce(null);
      await expect(getEmployeeCompensation('emp-999')).rejects.toMatchObject({
        code: 'EMPLOYEE_NOT_FOUND',
      });
    });

    it('should return null when employee has no zitadelId', async () => {
      mockLocalFindFirst.mockResolvedValueOnce(mockLocalEmployee({ zitadelId: null }));
      const result = await getEmployeeCompensation('emp-1');
      expect(result).toBeNull();
    });

    it('should return null when employee not found in app-portal', async () => {
      mockLocalFindFirst.mockResolvedValueOnce(mockLocalEmployee());
      setupPortalSelect([]); // no results
      const result = await getEmployeeCompensation('emp-1');
      expect(result).toBeNull();
    });

    it('should return SALARIED compensation with weekly pay', async () => {
      mockLocalFindFirst.mockResolvedValueOnce(mockLocalEmployee());
      setupPortalSelect([mockPortalEmployee()]);

      const result = await getEmployeeCompensation('emp-1');

      expect(result).not.toBeNull();
      expect(result!.compensationType).toBe('SALARIED');
      expect(result!.weeklyPay).toBe('1000.00'); // 52000 / 52
      expect(result!.exemptStatus).toBe('NON_EXEMPT');
    });

    it('should return PER_TASK compensation with no weekly pay', async () => {
      mockLocalFindFirst.mockResolvedValueOnce(mockLocalEmployee());
      setupPortalSelect([mockPortalEmployee({ compensationType: 'PER_TASK', annualSalary: null })]);

      const result = await getEmployeeCompensation('emp-1');

      expect(result).not.toBeNull();
      expect(result!.compensationType).toBe('PER_TASK');
      expect(result!.weeklyPay).toBeNull();
    });

    it('should throw MISSING_SALARY_DATA for salaried employee without salary', async () => {
      mockLocalFindFirst.mockResolvedValueOnce(mockLocalEmployee());
      setupPortalSelect([mockPortalEmployee({ compensationType: 'SALARIED', annualSalary: null })]);

      await expect(getEmployeeCompensation('emp-1')).rejects.toMatchObject({
        code: 'MISSING_SALARY_DATA',
      });
    });
  });

  describe('getSalariedWeeklyPay', () => {
    it('should return null for PER_TASK employees', async () => {
      mockLocalFindFirst.mockResolvedValueOnce(mockLocalEmployee());
      setupPortalSelect([mockPortalEmployee({ compensationType: 'PER_TASK', annualSalary: null })]);

      const result = await getSalariedWeeklyPay('emp-1');
      expect(result).toBeNull();
    });

    it('should return null when portal DB is not configured', async () => {
      mockPortalDb = null;
      const result = await getSalariedWeeklyPay('emp-1');
      expect(result).toBeNull();
    });

    it('should calculate correct weekly pay for salaried employee', async () => {
      mockLocalFindFirst.mockResolvedValueOnce(mockLocalEmployee());
      setupPortalSelect([mockPortalEmployee({ annualSalary: '52000.00' })]);

      const result = await getSalariedWeeklyPay('emp-1');

      expect(result).not.toBeNull();
      expect(result!.weeklyPay.toFixed(2)).toBe('1000.00');
      expect(result!.annualSalary.toFixed(2)).toBe('52000.00');
      expect(result!.exemptStatus).toBe('NON_EXEMPT');
      expect(result!.warnings).toHaveLength(0);
    });

    it('should warn when EXEMPT employee is below FLSA threshold', async () => {
      // $20,000/yr = $384.62/week — below $684/week threshold
      mockLocalFindFirst.mockResolvedValueOnce(mockLocalEmployee());
      setupPortalSelect([
        mockPortalEmployee({
          annualSalary: '20000.00',
          exemptStatus: 'EXEMPT',
        }),
      ]);

      const result = await getSalariedWeeklyPay('emp-1');

      expect(result).not.toBeNull();
      expect(result!.warnings).toHaveLength(1);
      expect(result!.warnings[0]).toContain('FLSA warning');
      expect(result!.warnings[0]).toContain('$384.62');
      expect(result!.warnings[0]).toContain('$684.00');
    });

    it('should NOT warn when EXEMPT employee is above FLSA threshold', async () => {
      // $52,000/yr = $1000/week — above $684/week threshold
      mockLocalFindFirst.mockResolvedValueOnce(mockLocalEmployee());
      setupPortalSelect([
        mockPortalEmployee({
          annualSalary: '52000.00',
          exemptStatus: 'EXEMPT',
        }),
      ]);

      const result = await getSalariedWeeklyPay('emp-1');

      expect(result).not.toBeNull();
      expect(result!.warnings).toHaveLength(0);
    });

    it('should NOT warn for NON_EXEMPT regardless of salary', async () => {
      mockLocalFindFirst.mockResolvedValueOnce(mockLocalEmployee());
      setupPortalSelect([
        mockPortalEmployee({
          annualSalary: '20000.00',
          exemptStatus: 'NON_EXEMPT',
        }),
      ]);

      const result = await getSalariedWeeklyPay('emp-1');

      expect(result).not.toBeNull();
      expect(result!.warnings).toHaveLength(0);
    });
  });

  describe('Weekly pay calculation (pure math)', () => {
    it('should calculate $52,000/yr → $1,000.00/week', () => {
      const weeklyPay = new Decimal('52000').dividedBy(52);
      expect(weeklyPay.toFixed(2)).toBe('1000.00');
    });

    it('should calculate $35,568/yr → $684.00/week (FLSA threshold)', () => {
      const weeklyPay = new Decimal('35568').dividedBy(52);
      expect(weeklyPay.toFixed(2)).toBe('684.00');
    });

    it('should handle odd annual salaries without rounding errors', () => {
      // $45,000/yr = $865.384615.../week
      const weeklyPay = new Decimal('45000').dividedBy(52);
      expect(weeklyPay.toFixed(2)).toBe('865.38');
    });

    it('should calculate hourly rate from annual salary and expected hours', () => {
      // $52,000/yr ÷ 2080 hrs = $25.00/hr
      const hourlyRate = new Decimal('52000').dividedBy(2080);
      expect(hourlyRate.toFixed(2)).toBe('25.00');
    });

    it('should calculate fluctuating workweek OT (FLSA method)', () => {
      // Salaried NON_EXEMPT: weekly pay = $1000, worked 45 hrs
      // OT premium = (weeklyPay / actualHrs) × 0.5 × otHrs
      // = ($1000 / 45) × 0.5 × 5 = $55.56
      const weeklyPay = new Decimal('1000');
      const actualHours = new Decimal('45');
      const otHours = new Decimal('5');

      const effectiveRate = weeklyPay.dividedBy(actualHours);
      const otPremium = effectiveRate.times(new Decimal('0.5')).times(otHours);

      expect(effectiveRate.toFixed(4)).toBe('22.2222');
      expect(otPremium.toFixed(2)).toBe('55.56');
    });
  });
});
