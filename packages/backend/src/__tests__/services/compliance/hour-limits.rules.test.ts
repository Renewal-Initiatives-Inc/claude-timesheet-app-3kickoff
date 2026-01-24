import { describe, it, expect } from 'vitest';
import type { ComplianceContext } from '../../../services/compliance/types.js';
import type { AgeBand } from '../../../utils/age.js';
import {
  dailyLimit12_13Rule,
  weeklyLimit12_13Rule,
  schoolDayLimit14_15Rule,
  schoolWeekLimit14_15Rule,
  nonSchoolDayLimit14_15Rule,
  nonSchoolWeekLimit14_15Rule,
  dailyLimit16_17Rule,
  weeklyLimit16_17Rule,
  dayCountLimit16_17Rule,
} from '../../../services/compliance/rules/hour-limits.rules.js';

/**
 * Helper to create mock compliance context for testing.
 */
function createMockContext(
  options: {
    ageBand?: AgeBand;
    dailyHours?: Record<string, number>;
    schoolDays?: string[];
    isSchoolWeek?: boolean;
  } = {}
): ComplianceContext {
  const {
    ageBand = '14-15',
    dailyHours = {},
    schoolDays = [],
    isSchoolWeek = false,
  } = options;

  const dailyHoursMap = new Map<string, number>(Object.entries(dailyHours));
  const dailyAgeBands = new Map<string, AgeBand>();
  const dailyAges = new Map<string, number>();
  const dailyEntries = new Map<string, any[]>();

  // Set age band and create entries for each day
  for (const date of dailyHoursMap.keys()) {
    dailyAgeBands.set(date, ageBand);
    dailyAges.set(date, ageBand === '12-13' ? 13 : ageBand === '14-15' ? 15 : 17);
    dailyEntries.set(date, [{
      id: `entry-${date}`,
      workDate: date,
      isSchoolDay: schoolDays.includes(date),
    }]);
  }

  return {
    employee: {
      id: 'emp-1',
      name: 'Test Employee',
      email: 'test@example.com',
      dateOfBirth: '2010-01-01',
      isSupervisor: false,
    },
    timesheet: {
      id: 'ts-1',
      employeeId: 'emp-1',
      weekStartDate: '2024-06-09',
      status: 'open',
      submittedAt: null,
      reviewedBy: null,
      reviewedAt: null,
      supervisorNotes: null,
      createdAt: '2024-06-09T00:00:00.000Z',
      updatedAt: '2024-06-09T00:00:00.000Z',
      entries: [],
      totals: { daily: dailyHours, weekly: Object.values(dailyHours).reduce((a, b) => a + b, 0) },
    },
    documents: [],
    dailyAges,
    dailyAgeBands,
    dailyHours: dailyHoursMap,
    dailyEntries,
    schoolDays,
    workDays: Array.from(dailyHoursMap.keys()),
    weeklyTotal: Object.values(dailyHours).reduce((a, b) => a + b, 0),
    isSchoolWeek,
    checkDate: '2024-06-15',
  };
}

describe('Hour Limit Rules', () => {
  describe('RULE-002: Ages 12-13 Daily Limit (4 hours)', () => {
    it('should pass when daily hours are within limit', () => {
      const context = createMockContext({
        ageBand: '12-13',
        dailyHours: { '2024-06-10': 3, '2024-06-11': 4 },
      });

      const result = dailyLimit12_13Rule.evaluate(context);

      expect(result.result).toBe('pass');
      expect(result.ruleId).toBe('RULE-002');
    });

    it('should fail when daily hours exceed limit', () => {
      const context = createMockContext({
        ageBand: '12-13',
        dailyHours: { '2024-06-10': 5, '2024-06-11': 3 },
      });

      const result = dailyLimit12_13Rule.evaluate(context);

      expect(result.result).toBe('fail');
      expect(result.details.actualValue).toBe(5);
      expect(result.details.threshold).toBe(4);
      expect(result.details.affectedDates).toContain('2024-06-10');
    });

    it('should report multiple violations', () => {
      const context = createMockContext({
        ageBand: '12-13',
        dailyHours: { '2024-06-10': 5, '2024-06-11': 6 },
      });

      const result = dailyLimit12_13Rule.evaluate(context);

      expect(result.result).toBe('fail');
      expect(result.details.affectedDates).toHaveLength(2);
    });
  });

  describe('RULE-003: Ages 12-13 Weekly Limit (24 hours)', () => {
    it('should pass when weekly hours are within limit', () => {
      const context = createMockContext({
        ageBand: '12-13',
        dailyHours: {
          '2024-06-10': 4,
          '2024-06-11': 4,
          '2024-06-12': 4,
          '2024-06-13': 4,
          '2024-06-14': 4,
        },
      });

      const result = weeklyLimit12_13Rule.evaluate(context);

      expect(result.result).toBe('pass');
    });

    it('should fail when weekly hours exceed limit', () => {
      const context = createMockContext({
        ageBand: '12-13',
        dailyHours: {
          '2024-06-10': 4,
          '2024-06-11': 4,
          '2024-06-12': 4,
          '2024-06-13': 4,
          '2024-06-14': 4,
          '2024-06-15': 5,
        },
      });

      const result = weeklyLimit12_13Rule.evaluate(context);

      expect(result.result).toBe('fail');
      expect(result.details.actualValue).toBe(25);
      expect(result.details.threshold).toBe(24);
    });
  });

  describe('RULE-008: Ages 14-15 School Day Limit (3 hours)', () => {
    it('should pass when school day hours are within limit', () => {
      const context = createMockContext({
        ageBand: '14-15',
        dailyHours: { '2024-06-10': 3, '2024-06-11': 2 },
        schoolDays: ['2024-06-10', '2024-06-11'],
        isSchoolWeek: true,
      });

      const result = schoolDayLimit14_15Rule.evaluate(context);

      expect(result.result).toBe('pass');
    });

    it('should fail when school day hours exceed limit', () => {
      const context = createMockContext({
        ageBand: '14-15',
        dailyHours: { '2024-06-10': 4, '2024-06-11': 3 },
        schoolDays: ['2024-06-10', '2024-06-11'],
        isSchoolWeek: true,
      });

      const result = schoolDayLimit14_15Rule.evaluate(context);

      expect(result.result).toBe('fail');
      expect(result.details.actualValue).toBe(4);
      expect(result.details.threshold).toBe(3);
    });

    it('should not check non-school days', () => {
      const context = createMockContext({
        ageBand: '14-15',
        dailyHours: { '2024-06-10': 8, '2024-06-11': 3 },
        schoolDays: ['2024-06-11'],
        isSchoolWeek: true,
      });

      const result = schoolDayLimit14_15Rule.evaluate(context);

      expect(result.result).toBe('pass');
    });
  });

  describe('RULE-009: Ages 14-15 School Week Limit (18 hours)', () => {
    it('should return not_applicable for non-school weeks', () => {
      const context = createMockContext({
        ageBand: '14-15',
        dailyHours: { '2024-06-10': 8 },
        isSchoolWeek: false,
      });

      const result = schoolWeekLimit14_15Rule.evaluate(context);

      expect(result.result).toBe('not_applicable');
    });

    it('should pass when school week hours are within limit', () => {
      const context = createMockContext({
        ageBand: '14-15',
        dailyHours: { '2024-06-10': 3, '2024-06-11': 3, '2024-06-12': 3 },
        schoolDays: ['2024-06-10'],
        isSchoolWeek: true,
      });

      const result = schoolWeekLimit14_15Rule.evaluate(context);

      expect(result.result).toBe('pass');
    });

    it('should fail when school week hours exceed limit', () => {
      const context = createMockContext({
        ageBand: '14-15',
        dailyHours: {
          '2024-06-10': 3,
          '2024-06-11': 3,
          '2024-06-12': 3,
          '2024-06-13': 3,
          '2024-06-14': 3,
          '2024-06-15': 4,
        },
        schoolDays: ['2024-06-10'],
        isSchoolWeek: true,
      });

      const result = schoolWeekLimit14_15Rule.evaluate(context);

      expect(result.result).toBe('fail');
      expect(result.details.actualValue).toBe(19);
      expect(result.details.threshold).toBe(18);
    });
  });

  describe('RULE-032: Ages 14-15 Non-School Day Limit (8 hours)', () => {
    it('should pass when non-school day hours are within limit', () => {
      const context = createMockContext({
        ageBand: '14-15',
        dailyHours: { '2024-06-10': 8, '2024-06-11': 7 },
        schoolDays: [],
        isSchoolWeek: false,
      });

      const result = nonSchoolDayLimit14_15Rule.evaluate(context);

      expect(result.result).toBe('pass');
    });

    it('should fail when non-school day hours exceed limit', () => {
      const context = createMockContext({
        ageBand: '14-15',
        dailyHours: { '2024-06-10': 9 },
        schoolDays: [],
        isSchoolWeek: false,
      });

      const result = nonSchoolDayLimit14_15Rule.evaluate(context);

      expect(result.result).toBe('fail');
      expect(result.details.actualValue).toBe(9);
      expect(result.details.threshold).toBe(8);
    });
  });

  describe('RULE-033: Ages 14-15 Non-School Week Limit (40 hours)', () => {
    it('should return not_applicable for school weeks', () => {
      const context = createMockContext({
        ageBand: '14-15',
        dailyHours: { '2024-06-10': 8 },
        schoolDays: ['2024-06-10'],
        isSchoolWeek: true,
      });

      const result = nonSchoolWeekLimit14_15Rule.evaluate(context);

      expect(result.result).toBe('not_applicable');
    });

    it('should pass when non-school week hours are within limit', () => {
      const context = createMockContext({
        ageBand: '14-15',
        dailyHours: {
          '2024-06-10': 8,
          '2024-06-11': 8,
          '2024-06-12': 8,
          '2024-06-13': 8,
          '2024-06-14': 8,
        },
        isSchoolWeek: false,
      });

      const result = nonSchoolWeekLimit14_15Rule.evaluate(context);

      expect(result.result).toBe('pass');
    });

    it('should fail when non-school week hours exceed limit', () => {
      const context = createMockContext({
        ageBand: '14-15',
        dailyHours: {
          '2024-06-10': 8,
          '2024-06-11': 8,
          '2024-06-12': 8,
          '2024-06-13': 8,
          '2024-06-14': 8,
          '2024-06-15': 1,
        },
        isSchoolWeek: false,
      });

      const result = nonSchoolWeekLimit14_15Rule.evaluate(context);

      expect(result.result).toBe('fail');
      expect(result.details.actualValue).toBe(41);
      expect(result.details.threshold).toBe(40);
    });
  });

  describe('RULE-014: Ages 16-17 Daily Limit (9 hours)', () => {
    it('should pass when daily hours are within limit', () => {
      const context = createMockContext({
        ageBand: '16-17',
        dailyHours: { '2024-06-10': 9, '2024-06-11': 8 },
      });

      const result = dailyLimit16_17Rule.evaluate(context);

      expect(result.result).toBe('pass');
    });

    it('should fail when daily hours exceed limit', () => {
      const context = createMockContext({
        ageBand: '16-17',
        dailyHours: { '2024-06-10': 10 },
      });

      const result = dailyLimit16_17Rule.evaluate(context);

      expect(result.result).toBe('fail');
      expect(result.details.actualValue).toBe(10);
      expect(result.details.threshold).toBe(9);
    });
  });

  describe('RULE-015: Ages 16-17 Weekly Limit (48 hours)', () => {
    it('should pass when weekly hours are within limit', () => {
      const context = createMockContext({
        ageBand: '16-17',
        dailyHours: {
          '2024-06-10': 8,
          '2024-06-11': 8,
          '2024-06-12': 8,
          '2024-06-13': 8,
          '2024-06-14': 8,
          '2024-06-15': 8,
        },
      });

      const result = weeklyLimit16_17Rule.evaluate(context);

      expect(result.result).toBe('pass');
    });

    it('should fail when weekly hours exceed limit', () => {
      const context = createMockContext({
        ageBand: '16-17',
        dailyHours: {
          '2024-06-10': 9,
          '2024-06-11': 9,
          '2024-06-12': 9,
          '2024-06-13': 9,
          '2024-06-14': 9,
          '2024-06-15': 9,
        },
      });

      const result = weeklyLimit16_17Rule.evaluate(context);

      expect(result.result).toBe('fail');
      expect(result.details.actualValue).toBe(54);
      expect(result.details.threshold).toBe(48);
    });
  });

  describe('RULE-018: Ages 16-17 Day Count Limit (6 days)', () => {
    it('should pass when working 6 or fewer days', () => {
      const context = createMockContext({
        ageBand: '16-17',
        dailyHours: {
          '2024-06-10': 8,
          '2024-06-11': 8,
          '2024-06-12': 8,
          '2024-06-13': 8,
          '2024-06-14': 8,
          '2024-06-15': 8,
        },
      });

      const result = dayCountLimit16_17Rule.evaluate(context);

      expect(result.result).toBe('pass');
    });

    it('should fail when working more than 6 days', () => {
      const context = createMockContext({
        ageBand: '16-17',
        dailyHours: {
          '2024-06-09': 4,
          '2024-06-10': 8,
          '2024-06-11': 8,
          '2024-06-12': 8,
          '2024-06-13': 8,
          '2024-06-14': 8,
          '2024-06-15': 8,
        },
      });

      const result = dayCountLimit16_17Rule.evaluate(context);

      expect(result.result).toBe('fail');
      expect(result.details.actualValue).toBe(7);
      expect(result.details.threshold).toBe(6);
    });
  });
});
