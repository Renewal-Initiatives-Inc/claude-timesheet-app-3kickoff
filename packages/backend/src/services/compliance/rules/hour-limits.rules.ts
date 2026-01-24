/**
 * Hour Limit Compliance Rules.
 *
 * These rules enforce daily and weekly hour limits by age band:
 * - RULE-002: Ages 12-13 daily limit (4 hours)
 * - RULE-003: Ages 12-13 weekly limit (24 hours)
 * - RULE-008: Ages 14-15 school day limit (3 hours)
 * - RULE-009: Ages 14-15 school week limit (18 hours)
 * - RULE-014: Ages 16-17 daily limit (9 hours)
 * - RULE-015: Ages 16-17 weekly limit (48 hours)
 * - RULE-018: Ages 16-17 day count limit (6 days)
 * - RULE-032: Ages 14-15 non-school day limit (8 hours)
 * - RULE-033: Ages 14-15 non-school week limit (40 hours)
 */

import type { ComplianceRule, ComplianceContext, RuleResult } from '../types.js';
import {
  RULE_002_MESSAGE,
  RULE_003_MESSAGE,
  RULE_008_MESSAGE,
  RULE_009_MESSAGE,
  RULE_014_MESSAGE,
  RULE_015_MESSAGE,
  RULE_018_MESSAGE,
  RULE_032_MESSAGE,
  RULE_033_MESSAGE,
} from '../messages.js';

// Hour limits by age band
const LIMITS = {
  '12-13': {
    daily: 4,
    weekly: 24,
  },
  '14-15': {
    dailySchool: 3,
    dailyNonSchool: 8,
    weeklySchool: 18,
    weeklyNonSchool: 40,
  },
  '16-17': {
    daily: 9,
    weekly: 48,
    maxDays: 6,
  },
};

/**
 * RULE-002: Ages 12-13 daily hour limit (4 hours).
 */
export const dailyLimit12_13Rule: ComplianceRule = {
  id: 'RULE-002',
  name: 'Ages 12-13 Daily Hour Limit',
  category: 'hours',
  appliesToAgeBands: ['12-13'],

  evaluate: (context: ComplianceContext): RuleResult => {
    const limit = LIMITS['12-13'].daily;
    const violations: { date: string; hours: number }[] = [];

    // Check each day where employee was 12-13
    for (const [date, hours] of context.dailyHours) {
      const ageBand = context.dailyAgeBands.get(date);
      if (ageBand === '12-13' && hours > limit) {
        violations.push({ date, hours });
      }
    }

    if (violations.length === 0) {
      return {
        ruleId: 'RULE-002',
        ruleName: 'Ages 12-13 Daily Hour Limit',
        result: 'pass',
        details: {
          ruleDescription: `Daily limit of ${limit} hours for ages 12-13`,
          checkedValues: { limit, daysChecked: context.dailyHours.size },
          threshold: limit,
        },
      };
    }

    // Report first violation (most important)
    const firstViolation = violations[0]!;
    return {
      ruleId: 'RULE-002',
      ruleName: 'Ages 12-13 Daily Hour Limit',
      result: 'fail',
      details: {
        ruleDescription: `Daily limit of ${limit} hours for ages 12-13`,
        checkedValues: { violations },
        threshold: limit,
        actualValue: firstViolation.hours,
        affectedDates: violations.map((v) => v.date),
        message: RULE_002_MESSAGE.message(firstViolation.date, firstViolation.hours, limit),
      },
      errorMessage: RULE_002_MESSAGE.message(firstViolation.date, firstViolation.hours, limit),
      remediationGuidance: RULE_002_MESSAGE.remediation(limit),
    };
  },
};

/**
 * RULE-003: Ages 12-13 weekly hour limit (24 hours).
 */
export const weeklyLimit12_13Rule: ComplianceRule = {
  id: 'RULE-003',
  name: 'Ages 12-13 Weekly Hour Limit',
  category: 'hours',
  appliesToAgeBands: ['12-13'],

  evaluate: (context: ComplianceContext): RuleResult => {
    const limit = LIMITS['12-13'].weekly;

    // Sum hours only for days when employee was 12-13
    let total = 0;
    for (const [date, hours] of context.dailyHours) {
      const ageBand = context.dailyAgeBands.get(date);
      if (ageBand === '12-13') {
        total += hours;
      }
    }

    if (total <= limit) {
      return {
        ruleId: 'RULE-003',
        ruleName: 'Ages 12-13 Weekly Hour Limit',
        result: 'pass',
        details: {
          ruleDescription: `Weekly limit of ${limit} hours for ages 12-13`,
          checkedValues: { total },
          threshold: limit,
          actualValue: total,
        },
      };
    }

    return {
      ruleId: 'RULE-003',
      ruleName: 'Ages 12-13 Weekly Hour Limit',
      result: 'fail',
      details: {
        ruleDescription: `Weekly limit of ${limit} hours for ages 12-13`,
        checkedValues: { total },
        threshold: limit,
        actualValue: total,
        message: RULE_003_MESSAGE.message(total, limit),
      },
      errorMessage: RULE_003_MESSAGE.message(total, limit),
      remediationGuidance: RULE_003_MESSAGE.remediation(limit),
    };
  },
};

/**
 * RULE-008: Ages 14-15 school day limit (3 hours).
 */
export const schoolDayLimit14_15Rule: ComplianceRule = {
  id: 'RULE-008',
  name: 'Ages 14-15 School Day Limit',
  category: 'hours',
  appliesToAgeBands: ['14-15'],

  evaluate: (context: ComplianceContext): RuleResult => {
    const limit = LIMITS['14-15'].dailySchool;
    const violations: { date: string; hours: number }[] = [];

    // Check each school day where employee was 14-15
    for (const [date, hours] of context.dailyHours) {
      const ageBand = context.dailyAgeBands.get(date);
      if (ageBand === '14-15') {
        // Check if this date has any entries marked as school day
        const entries = context.dailyEntries.get(date) ?? [];
        const isSchoolDay = entries.some((e) => e.isSchoolDay);

        if (isSchoolDay && hours > limit) {
          violations.push({ date, hours });
        }
      }
    }

    if (violations.length === 0) {
      return {
        ruleId: 'RULE-008',
        ruleName: 'Ages 14-15 School Day Limit',
        result: 'pass',
        details: {
          ruleDescription: `School day limit of ${limit} hours for ages 14-15`,
          checkedValues: { limit, schoolDaysChecked: context.schoolDays.length },
          threshold: limit,
        },
      };
    }

    const firstViolation = violations[0]!;
    return {
      ruleId: 'RULE-008',
      ruleName: 'Ages 14-15 School Day Limit',
      result: 'fail',
      details: {
        ruleDescription: `School day limit of ${limit} hours for ages 14-15`,
        checkedValues: { violations },
        threshold: limit,
        actualValue: firstViolation.hours,
        affectedDates: violations.map((v) => v.date),
        message: RULE_008_MESSAGE.message(firstViolation.date, firstViolation.hours, limit),
      },
      errorMessage: RULE_008_MESSAGE.message(firstViolation.date, firstViolation.hours, limit),
      remediationGuidance: RULE_008_MESSAGE.remediation(limit),
    };
  },
};

/**
 * RULE-009: Ages 14-15 school week limit (18 hours).
 */
export const schoolWeekLimit14_15Rule: ComplianceRule = {
  id: 'RULE-009',
  name: 'Ages 14-15 School Week Limit',
  category: 'hours',
  appliesToAgeBands: ['14-15'],

  evaluate: (context: ComplianceContext): RuleResult => {
    // Only applies during school weeks
    if (!context.isSchoolWeek) {
      return {
        ruleId: 'RULE-009',
        ruleName: 'Ages 14-15 School Week Limit',
        result: 'not_applicable',
        details: {
          ruleDescription: 'School week limit only applies when there are school days',
          checkedValues: { isSchoolWeek: false },
        },
      };
    }

    const limit = LIMITS['14-15'].weeklySchool;

    // Sum hours only for days when employee was 14-15
    let total = 0;
    for (const [date, hours] of context.dailyHours) {
      const ageBand = context.dailyAgeBands.get(date);
      if (ageBand === '14-15') {
        total += hours;
      }
    }

    if (total <= limit) {
      return {
        ruleId: 'RULE-009',
        ruleName: 'Ages 14-15 School Week Limit',
        result: 'pass',
        details: {
          ruleDescription: `School week limit of ${limit} hours for ages 14-15`,
          checkedValues: { total, isSchoolWeek: true },
          threshold: limit,
          actualValue: total,
        },
      };
    }

    return {
      ruleId: 'RULE-009',
      ruleName: 'Ages 14-15 School Week Limit',
      result: 'fail',
      details: {
        ruleDescription: `School week limit of ${limit} hours for ages 14-15`,
        checkedValues: { total, isSchoolWeek: true },
        threshold: limit,
        actualValue: total,
        message: RULE_009_MESSAGE.message(total, limit),
      },
      errorMessage: RULE_009_MESSAGE.message(total, limit),
      remediationGuidance: RULE_009_MESSAGE.remediation(limit),
    };
  },
};

/**
 * RULE-032: Ages 14-15 non-school day limit (8 hours).
 */
export const nonSchoolDayLimit14_15Rule: ComplianceRule = {
  id: 'RULE-032',
  name: 'Ages 14-15 Non-School Day Limit',
  category: 'hours',
  appliesToAgeBands: ['14-15'],

  evaluate: (context: ComplianceContext): RuleResult => {
    const limit = LIMITS['14-15'].dailyNonSchool;
    const violations: { date: string; hours: number }[] = [];

    // Check each non-school day where employee was 14-15
    for (const [date, hours] of context.dailyHours) {
      const ageBand = context.dailyAgeBands.get(date);
      if (ageBand === '14-15') {
        const entries = context.dailyEntries.get(date) ?? [];
        const isSchoolDay = entries.some((e) => e.isSchoolDay);

        if (!isSchoolDay && hours > limit) {
          violations.push({ date, hours });
        }
      }
    }

    if (violations.length === 0) {
      return {
        ruleId: 'RULE-032',
        ruleName: 'Ages 14-15 Non-School Day Limit',
        result: 'pass',
        details: {
          ruleDescription: `Non-school day limit of ${limit} hours for ages 14-15`,
          checkedValues: { limit },
          threshold: limit,
        },
      };
    }

    const firstViolation = violations[0]!;
    return {
      ruleId: 'RULE-032',
      ruleName: 'Ages 14-15 Non-School Day Limit',
      result: 'fail',
      details: {
        ruleDescription: `Non-school day limit of ${limit} hours for ages 14-15`,
        checkedValues: { violations },
        threshold: limit,
        actualValue: firstViolation.hours,
        affectedDates: violations.map((v) => v.date),
        message: RULE_032_MESSAGE.message(firstViolation.date, firstViolation.hours, limit),
      },
      errorMessage: RULE_032_MESSAGE.message(firstViolation.date, firstViolation.hours, limit),
      remediationGuidance: RULE_032_MESSAGE.remediation(limit),
    };
  },
};

/**
 * RULE-033: Ages 14-15 non-school week limit (40 hours).
 */
export const nonSchoolWeekLimit14_15Rule: ComplianceRule = {
  id: 'RULE-033',
  name: 'Ages 14-15 Non-School Week Limit',
  category: 'hours',
  appliesToAgeBands: ['14-15'],

  evaluate: (context: ComplianceContext): RuleResult => {
    // Only applies during non-school weeks
    if (context.isSchoolWeek) {
      return {
        ruleId: 'RULE-033',
        ruleName: 'Ages 14-15 Non-School Week Limit',
        result: 'not_applicable',
        details: {
          ruleDescription: 'Non-school week limit only applies when there are no school days',
          checkedValues: { isSchoolWeek: true },
        },
      };
    }

    const limit = LIMITS['14-15'].weeklyNonSchool;

    // Sum hours only for days when employee was 14-15
    let total = 0;
    for (const [date, hours] of context.dailyHours) {
      const ageBand = context.dailyAgeBands.get(date);
      if (ageBand === '14-15') {
        total += hours;
      }
    }

    if (total <= limit) {
      return {
        ruleId: 'RULE-033',
        ruleName: 'Ages 14-15 Non-School Week Limit',
        result: 'pass',
        details: {
          ruleDescription: `Non-school week limit of ${limit} hours for ages 14-15`,
          checkedValues: { total, isSchoolWeek: false },
          threshold: limit,
          actualValue: total,
        },
      };
    }

    return {
      ruleId: 'RULE-033',
      ruleName: 'Ages 14-15 Non-School Week Limit',
      result: 'fail',
      details: {
        ruleDescription: `Non-school week limit of ${limit} hours for ages 14-15`,
        checkedValues: { total, isSchoolWeek: false },
        threshold: limit,
        actualValue: total,
        message: RULE_033_MESSAGE.message(total, limit),
      },
      errorMessage: RULE_033_MESSAGE.message(total, limit),
      remediationGuidance: RULE_033_MESSAGE.remediation(limit),
    };
  },
};

/**
 * RULE-014: Ages 16-17 daily hour limit (9 hours).
 */
export const dailyLimit16_17Rule: ComplianceRule = {
  id: 'RULE-014',
  name: 'Ages 16-17 Daily Hour Limit',
  category: 'hours',
  appliesToAgeBands: ['16-17'],

  evaluate: (context: ComplianceContext): RuleResult => {
    const limit = LIMITS['16-17'].daily;
    const violations: { date: string; hours: number }[] = [];

    // Check each day where employee was 16-17
    for (const [date, hours] of context.dailyHours) {
      const ageBand = context.dailyAgeBands.get(date);
      if (ageBand === '16-17' && hours > limit) {
        violations.push({ date, hours });
      }
    }

    if (violations.length === 0) {
      return {
        ruleId: 'RULE-014',
        ruleName: 'Ages 16-17 Daily Hour Limit',
        result: 'pass',
        details: {
          ruleDescription: `Daily limit of ${limit} hours for ages 16-17`,
          checkedValues: { limit, daysChecked: context.dailyHours.size },
          threshold: limit,
        },
      };
    }

    const firstViolation = violations[0]!;
    return {
      ruleId: 'RULE-014',
      ruleName: 'Ages 16-17 Daily Hour Limit',
      result: 'fail',
      details: {
        ruleDescription: `Daily limit of ${limit} hours for ages 16-17`,
        checkedValues: { violations },
        threshold: limit,
        actualValue: firstViolation.hours,
        affectedDates: violations.map((v) => v.date),
        message: RULE_014_MESSAGE.message(firstViolation.date, firstViolation.hours, limit),
      },
      errorMessage: RULE_014_MESSAGE.message(firstViolation.date, firstViolation.hours, limit),
      remediationGuidance: RULE_014_MESSAGE.remediation(limit),
    };
  },
};

/**
 * RULE-015: Ages 16-17 weekly hour limit (48 hours).
 */
export const weeklyLimit16_17Rule: ComplianceRule = {
  id: 'RULE-015',
  name: 'Ages 16-17 Weekly Hour Limit',
  category: 'hours',
  appliesToAgeBands: ['16-17'],

  evaluate: (context: ComplianceContext): RuleResult => {
    const limit = LIMITS['16-17'].weekly;

    // Sum hours only for days when employee was 16-17
    let total = 0;
    for (const [date, hours] of context.dailyHours) {
      const ageBand = context.dailyAgeBands.get(date);
      if (ageBand === '16-17') {
        total += hours;
      }
    }

    if (total <= limit) {
      return {
        ruleId: 'RULE-015',
        ruleName: 'Ages 16-17 Weekly Hour Limit',
        result: 'pass',
        details: {
          ruleDescription: `Weekly limit of ${limit} hours for ages 16-17`,
          checkedValues: { total },
          threshold: limit,
          actualValue: total,
        },
      };
    }

    return {
      ruleId: 'RULE-015',
      ruleName: 'Ages 16-17 Weekly Hour Limit',
      result: 'fail',
      details: {
        ruleDescription: `Weekly limit of ${limit} hours for ages 16-17`,
        checkedValues: { total },
        threshold: limit,
        actualValue: total,
        message: RULE_015_MESSAGE.message(total, limit),
      },
      errorMessage: RULE_015_MESSAGE.message(total, limit),
      remediationGuidance: RULE_015_MESSAGE.remediation(limit),
    };
  },
};

/**
 * RULE-018: Ages 16-17 day count limit (6 days max).
 */
export const dayCountLimit16_17Rule: ComplianceRule = {
  id: 'RULE-018',
  name: 'Ages 16-17 Day Count Limit',
  category: 'hours',
  appliesToAgeBands: ['16-17'],

  evaluate: (context: ComplianceContext): RuleResult => {
    const limit = LIMITS['16-17'].maxDays;

    // Count days where employee was 16-17 and worked
    const daysWorked: string[] = [];
    for (const [date] of context.dailyHours) {
      const ageBand = context.dailyAgeBands.get(date);
      if (ageBand === '16-17') {
        daysWorked.push(date);
      }
    }

    if (daysWorked.length <= limit) {
      return {
        ruleId: 'RULE-018',
        ruleName: 'Ages 16-17 Day Count Limit',
        result: 'pass',
        details: {
          ruleDescription: `Maximum ${limit} days per week for ages 16-17`,
          checkedValues: { daysWorked: daysWorked.length },
          threshold: limit,
          actualValue: daysWorked.length,
        },
      };
    }

    return {
      ruleId: 'RULE-018',
      ruleName: 'Ages 16-17 Day Count Limit',
      result: 'fail',
      details: {
        ruleDescription: `Maximum ${limit} days per week for ages 16-17`,
        checkedValues: { daysWorked: daysWorked.length, dates: daysWorked },
        threshold: limit,
        actualValue: daysWorked.length,
        affectedDates: daysWorked,
        message: RULE_018_MESSAGE.message(daysWorked.length, limit),
      },
      errorMessage: RULE_018_MESSAGE.message(daysWorked.length, limit),
      remediationGuidance: RULE_018_MESSAGE.remediation(limit),
    };
  },
};

/**
 * All hour limit rules.
 */
export const hourLimitRules: ComplianceRule[] = [
  // 12-13 rules
  dailyLimit12_13Rule,
  weeklyLimit12_13Rule,
  // 14-15 rules
  schoolDayLimit14_15Rule,
  schoolWeekLimit14_15Rule,
  nonSchoolDayLimit14_15Rule,
  nonSchoolWeekLimit14_15Rule,
  // 16-17 rules
  dailyLimit16_17Rule,
  weeklyLimit16_17Rule,
  dayCountLimit16_17Rule,
];
