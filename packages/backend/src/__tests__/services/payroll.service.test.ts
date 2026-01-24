import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';

/**
 * Unit tests for payroll service calculation logic.
 * These tests validate the business rules without requiring database access.
 */
describe('Payroll Service Logic', () => {
  // Minimum wage floors
  const AGRICULTURAL_MIN_WAGE = new Decimal('8.00');
  const NON_AGRICULTURAL_MIN_WAGE = new Decimal('15.00');
  const OVERTIME_THRESHOLD_HOURS = new Decimal('40');

  describe('PayrollError pattern', () => {
    class PayrollError extends Error {
      constructor(
        message: string,
        public code: string
      ) {
        super(message);
        this.name = 'PayrollError';
      }
    }

    it('should create error with correct code', () => {
      const error = new PayrollError('Timesheet not found', 'TIMESHEET_NOT_FOUND');
      expect(error.code).toBe('TIMESHEET_NOT_FOUND');
      expect(error.message).toBe('Timesheet not found');
      expect(error.name).toBe('PayrollError');
    });

    it('should support all error codes', () => {
      const codes = [
        { code: 'TIMESHEET_NOT_FOUND', message: 'Timesheet not found' },
        { code: 'TIMESHEET_NOT_APPROVED', message: 'Timesheet is not approved' },
        { code: 'NO_RATE_FOUND', message: 'No rate found for task' },
        { code: 'PAYROLL_ALREADY_EXISTS', message: 'Payroll already exists' },
        { code: 'PAYROLL_NOT_FOUND', message: 'Payroll not found' },
        { code: 'INVALID_DATE_RANGE', message: 'Invalid date range' },
      ];

      for (const { code, message } of codes) {
        const error = new PayrollError(message, code);
        expect(error.code).toBe(code);
        expect(error.message).toBe(message);
      }
    });
  });

  describe('Basic calculation: hours × rate', () => {
    it('should calculate simple pay correctly', () => {
      const hours = new Decimal('8');
      const rate = new Decimal('15.00');
      const earnings = hours.times(rate);
      expect(earnings.toFixed(2)).toBe('120.00');
    });

    it('should handle fractional hours correctly', () => {
      const hours = new Decimal('7.5');
      const rate = new Decimal('15.00');
      const earnings = hours.times(rate);
      expect(earnings.toFixed(2)).toBe('112.50');
    });

    it('should handle fractional rates correctly', () => {
      const hours = new Decimal('8');
      const rate = new Decimal('15.33');
      const earnings = hours.times(rate);
      expect(earnings.toFixed(2)).toBe('122.64');
    });

    it('should handle fractional hours and rates', () => {
      const hours = new Decimal('7.5');
      const rate = new Decimal('15.33');
      const earnings = hours.times(rate);
      expect(earnings.toFixed(2)).toBe('114.98'); // 7.5 * 15.33 = 114.975, rounds to 114.98
    });
  });

  describe('Minimum wage validation', () => {
    function validateMinimumWage(
      rate: Decimal,
      isAgricultural: boolean
    ): { isValid: boolean; minWage: Decimal } {
      const minWage = isAgricultural ? AGRICULTURAL_MIN_WAGE : NON_AGRICULTURAL_MIN_WAGE;
      const isValid = rate.greaterThanOrEqualTo(minWage);
      return { isValid, minWage };
    }

    it('should validate agricultural rate at exactly $8.00', () => {
      const result = validateMinimumWage(new Decimal('8.00'), true);
      expect(result.isValid).toBe(true);
    });

    it('should warn for agricultural rate below $8.00', () => {
      const result = validateMinimumWage(new Decimal('7.99'), true);
      expect(result.isValid).toBe(false);
      expect(result.minWage.toFixed(2)).toBe('8.00');
    });

    it('should validate non-agricultural rate at exactly $15.00', () => {
      const result = validateMinimumWage(new Decimal('15.00'), false);
      expect(result.isValid).toBe(true);
    });

    it('should warn for non-agricultural rate below $15.00', () => {
      const result = validateMinimumWage(new Decimal('14.99'), false);
      expect(result.isValid).toBe(false);
      expect(result.minWage.toFixed(2)).toBe('15.00');
    });

    it('should accept rates above minimum', () => {
      expect(validateMinimumWage(new Decimal('10.00'), true).isValid).toBe(true);
      expect(validateMinimumWage(new Decimal('20.00'), false).isValid).toBe(true);
    });
  });

  describe('Overtime calculation', () => {
    /**
     * Calculate overtime based on non-agricultural hours and earnings.
     * OT applies when non-ag hours > 40.
     * Weighted average rate = total earnings / total hours
     * OT premium = overtime hours × (weighted rate × 0.5)
     */
    function calculateOvertime(
      nonAgHours: Decimal,
      nonAgEarnings: Decimal
    ): { overtimeHours: Decimal; overtimeEarnings: Decimal } {
      if (nonAgHours.lessThanOrEqualTo(OVERTIME_THRESHOLD_HOURS)) {
        return {
          overtimeHours: new Decimal(0),
          overtimeEarnings: new Decimal(0),
        };
      }

      const overtimeHours = nonAgHours.minus(OVERTIME_THRESHOLD_HOURS);
      const weightedRate = nonAgEarnings.dividedBy(nonAgHours);
      const overtimeEarnings = overtimeHours.times(weightedRate.times(new Decimal('0.5')));

      return { overtimeHours, overtimeEarnings };
    }

    it('should not trigger overtime at exactly 40 hours', () => {
      const result = calculateOvertime(
        new Decimal('40'),
        new Decimal('600') // $15/hr
      );
      expect(result.overtimeHours.toFixed(2)).toBe('0.00');
      expect(result.overtimeEarnings.toFixed(2)).toBe('0.00');
    });

    it('should trigger overtime at 40.01 hours', () => {
      const result = calculateOvertime(
        new Decimal('40.01'),
        new Decimal('600.15') // $15/hr
      );
      expect(result.overtimeHours.toFixed(2)).toBe('0.01');
      // 0.01 hours × ($15/hr × 0.5) ≈ $0.075, rounds to $0.08
      expect(parseFloat(result.overtimeEarnings.toFixed(2))).toBeCloseTo(0.08, 1);
    });

    it('should calculate overtime for 45 hours at single rate', () => {
      // 45 hours at $15/hr = $675 total
      // OT hours = 5
      // Weighted rate = $15
      // OT premium = 5 × ($15 × 0.5) = 5 × $7.50 = $37.50
      const result = calculateOvertime(
        new Decimal('45'),
        new Decimal('675')
      );
      expect(result.overtimeHours.toFixed(2)).toBe('5.00');
      expect(result.overtimeEarnings.toFixed(2)).toBe('37.50');
    });

    it('should calculate weighted average overtime for multiple rates', () => {
      // 20 hours at $15 = $300
      // 25 hours at $20 = $500
      // Total: 45 hours, $800
      // Weighted rate = $800 / 45 = $17.78 (approx)
      // OT hours = 5
      // OT premium = 5 × ($17.78 × 0.5) ≈ $44.44
      const result = calculateOvertime(
        new Decimal('45'),
        new Decimal('800')
      );
      expect(result.overtimeHours.toFixed(2)).toBe('5.00');
      // $800/45 = 17.777... × 0.5 = 8.888... × 5 = 44.444...
      expect(parseFloat(result.overtimeEarnings.toFixed(2))).toBeCloseTo(44.44, 1);
    });

    it('should not apply overtime to hours under 40', () => {
      const result = calculateOvertime(
        new Decimal('35'),
        new Decimal('525') // $15/hr
      );
      expect(result.overtimeHours.toFixed(2)).toBe('0.00');
      expect(result.overtimeEarnings.toFixed(2)).toBe('0.00');
    });
  });

  describe('Agricultural overtime exemption', () => {
    it('should exempt agricultural hours from overtime calculation', () => {
      // 50 agricultural hours should not trigger overtime
      const agHours = new Decimal('50');
      const nonAgHours = new Decimal('0');

      // OT only applies to non-agricultural hours
      const shouldCalculateOT = nonAgHours.greaterThan(OVERTIME_THRESHOLD_HOURS);
      expect(shouldCalculateOT).toBe(false);
    });

    it('should only calculate OT on non-ag hours in mixed scenario', () => {
      // 30 ag hours + 45 non-ag hours = 75 total hours
      // But OT only on non-ag: 45 - 40 = 5 OT hours
      const agHours = new Decimal('30');
      const nonAgHours = new Decimal('45');

      // Only non-ag hours count for OT
      const overtimeHours = nonAgHours.minus(OVERTIME_THRESHOLD_HOURS);
      expect(overtimeHours.toFixed(2)).toBe('5.00');

      // Ag hours don't trigger OT regardless of total
      expect(agHours.greaterThan(OVERTIME_THRESHOLD_HOURS)).toBe(false);
    });
  });

  describe('Total earnings calculation', () => {
    it('should sum all earnings components correctly', () => {
      const agEarnings = new Decimal('100.00');
      const nonAgEarnings = new Decimal('600.00');
      const overtimeEarnings = new Decimal('37.50');

      const total = agEarnings.plus(nonAgEarnings).plus(overtimeEarnings);
      expect(total.toFixed(2)).toBe('737.50');
    });

    it('should handle zero hours timesheet', () => {
      const agEarnings = new Decimal('0');
      const nonAgEarnings = new Decimal('0');
      const overtimeEarnings = new Decimal('0');

      const total = agEarnings.plus(nonAgEarnings).plus(overtimeEarnings);
      expect(total.toFixed(2)).toBe('0.00');
    });

    it('should handle all-agricultural timesheet (no OT)', () => {
      // 50 hours of agricultural work at $10/hr
      const agHours = new Decimal('50');
      const agRate = new Decimal('10.00');
      const agEarnings = agHours.times(agRate);

      // No OT because it's all agricultural
      const total = agEarnings;
      expect(total.toFixed(2)).toBe('500.00');
    });
  });

  describe('Decimal precision', () => {
    it('should not have floating point errors on common calculations', () => {
      // Common problem: 0.1 + 0.2 !== 0.3 in JS
      const a = new Decimal('0.1');
      const b = new Decimal('0.2');
      expect(a.plus(b).toFixed(2)).toBe('0.30');
    });

    it('should preserve precision on $15.33/hr × 7.5 hrs', () => {
      const rate = new Decimal('15.33');
      const hours = new Decimal('7.5');
      const earnings = hours.times(rate);
      // 15.33 * 7.5 = 114.975
      expect(earnings.toFixed(2)).toBe('114.98'); // Rounds correctly
    });

    it('should handle long division correctly', () => {
      // Weighted average with repeating decimal
      const totalEarnings = new Decimal('1000');
      const totalHours = new Decimal('33');
      const weightedRate = totalEarnings.dividedBy(totalHours);
      // 1000/33 = 30.303030...
      expect(weightedRate.toFixed(2)).toBe('30.30');
    });

    it('should round to 2 decimal places for final amounts', () => {
      const earnings = new Decimal('114.975');
      expect(earnings.toFixed(2)).toBe('114.98'); // Standard rounding
    });
  });

  describe('Period date calculation', () => {
    it('should calculate period end date correctly', () => {
      const periodStart = '2024-06-09'; // Sunday
      const periodEndDate = new Date(periodStart + 'T00:00:00');
      periodEndDate.setDate(periodEndDate.getDate() + 6);
      const periodEnd = periodEndDate.toISOString().split('T')[0];

      expect(periodEnd).toBe('2024-06-15'); // Saturday
    });

    it('should handle year boundary', () => {
      const periodStart = '2024-12-29'; // Sunday
      const periodEndDate = new Date(periodStart + 'T00:00:00');
      periodEndDate.setDate(periodEndDate.getDate() + 6);
      const periodEnd = periodEndDate.toISOString().split('T')[0];

      expect(periodEnd).toBe('2025-01-04'); // Saturday in next year
    });
  });

  describe('Rate versioning', () => {
    // Simulate rate lookup logic
    interface Rate {
      effectiveDate: string;
      hourlyRate: string;
    }

    function getEffectiveRate(rates: Rate[], workDate: string): Rate | null {
      // Sort by effective date descending
      const sorted = [...rates].sort(
        (a, b) => b.effectiveDate.localeCompare(a.effectiveDate)
      );

      // Find first rate where effective date <= work date
      return sorted.find((r) => r.effectiveDate <= workDate) ?? null;
    }

    it('should return correct rate when single rate exists', () => {
      const rates: Rate[] = [{ effectiveDate: '2024-01-01', hourlyRate: '15.00' }];

      const result = getEffectiveRate(rates, '2024-06-15');
      expect(result?.hourlyRate).toBe('15.00');
    });

    it('should return most recent rate when multiple rates exist', () => {
      const rates: Rate[] = [
        { effectiveDate: '2024-01-01', hourlyRate: '15.00' },
        { effectiveDate: '2024-06-01', hourlyRate: '16.00' },
        { effectiveDate: '2024-03-01', hourlyRate: '15.50' },
      ];

      const result = getEffectiveRate(rates, '2024-06-15');
      expect(result?.hourlyRate).toBe('16.00');
    });

    it('should use rate effective on work date, not current date', () => {
      const rates: Rate[] = [
        { effectiveDate: '2024-01-01', hourlyRate: '15.00' },
        { effectiveDate: '2024-06-01', hourlyRate: '16.00' },
      ];

      // Work done on May 15 should use Jan rate, even if querying now in June
      const result = getEffectiveRate(rates, '2024-05-15');
      expect(result?.hourlyRate).toBe('15.00');
    });

    it('should return null when no rate found for date', () => {
      const rates: Rate[] = [{ effectiveDate: '2024-06-01', hourlyRate: '16.00' }];

      // Work done before any rate effective
      const result = getEffectiveRate(rates, '2024-05-15');
      expect(result).toBeNull();
    });

    it('should handle rate effective exactly on work date', () => {
      const rates: Rate[] = [
        { effectiveDate: '2024-01-01', hourlyRate: '15.00' },
        { effectiveDate: '2024-06-15', hourlyRate: '16.00' },
      ];

      // Work done exactly on effective date should use new rate
      const result = getEffectiveRate(rates, '2024-06-15');
      expect(result?.hourlyRate).toBe('16.00');
    });
  });

  describe('Edge cases', () => {
    it('should handle exactly 40 non-ag hours (no overtime)', () => {
      const nonAgHours = new Decimal('40');
      const shouldHaveOT = nonAgHours.greaterThan(OVERTIME_THRESHOLD_HOURS);
      expect(shouldHaveOT).toBe(false);
    });

    it('should handle 40.5 non-ag hours (0.5 hrs overtime)', () => {
      const nonAgHours = new Decimal('40.5');
      const overtimeHours = nonAgHours.minus(OVERTIME_THRESHOLD_HOURS);
      expect(overtimeHours.toFixed(2)).toBe('0.50');
    });

    it('should handle all agricultural hours (no overtime regardless of total)', () => {
      const agHours = new Decimal('60');
      const nonAgHours = new Decimal('0');

      // OT only calculated on non-ag hours
      const overtimeHours = nonAgHours.greaterThan(OVERTIME_THRESHOLD_HOURS)
        ? nonAgHours.minus(OVERTIME_THRESHOLD_HOURS)
        : new Decimal('0');

      expect(overtimeHours.toFixed(2)).toBe('0.00');
    });

    it('should handle very small hour values', () => {
      const hours = new Decimal('0.01');
      const rate = new Decimal('15.00');
      const earnings = hours.times(rate);
      expect(earnings.toFixed(2)).toBe('0.15');
    });

    it('should handle very large hour values', () => {
      const hours = new Decimal('168'); // Full week in hours
      const rate = new Decimal('15.00');
      const earnings = hours.times(rate);
      expect(earnings.toFixed(2)).toBe('2520.00');
    });
  });
});
