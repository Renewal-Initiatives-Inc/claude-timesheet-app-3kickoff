/**
 * Time Window Compliance Rules.
 *
 * These rules enforce work hour restrictions by time of day:
 * - RULE-004: Ages 12-13 school hours prohibition
 * - RULE-010: Ages 14-15 school hours prohibition
 * - RULE-011: Ages 14-15 work window (7 AM - 7 PM / 9 PM summer)
 * - RULE-016: Ages 16-17 school night restriction (10 PM)
 * - RULE-017: Ages 16-17 work window (6 AM - 11:30 PM)
 * - RULE-034: Ages 16-17 school hours prohibition
 * - RULE-036: All minors school hours prohibition (master rule)
 */

import type { ComplianceRule, ComplianceContext, RuleResult } from '../types.js';
import { timeToMinutes } from '../../../utils/timezone.js';
import {
  RULE_004_MESSAGE,
  RULE_010_MESSAGE,
  RULE_011_MESSAGE,
  RULE_016_MESSAGE,
  RULE_017_MESSAGE,
  RULE_034_MESSAGE,
} from '../messages.js';

// Time constants in minutes since midnight
const SCHOOL_START = 7 * 60; // 7:00 AM
const SCHOOL_END = 15 * 60; // 3:00 PM

const WINDOW_14_15_START = 7 * 60; // 7:00 AM
const WINDOW_14_15_END_REGULAR = 19 * 60; // 7:00 PM
const WINDOW_14_15_END_SUMMER = 21 * 60; // 9:00 PM

const WINDOW_16_17_START = 6 * 60; // 6:00 AM
const WINDOW_16_17_END_SCHOOL_NIGHT = 22 * 60; // 10:00 PM
const WINDOW_16_17_END_NONSCHOOL_NIGHT = 23 * 60 + 30; // 11:30 PM

/**
 * Check if a date is during the summer period (Jun 1 - Labor Day).
 * Labor Day is the first Monday of September.
 */
function isSummerPeriod(dateStr: string): boolean {
  const date = new Date(dateStr + 'T00:00:00');
  const month = date.getMonth(); // 0-indexed
  const day = date.getDate();

  // June 1 through August
  if (month >= 5 && month <= 7) {
    if (month === 5 && day < 1) return false;
    return true;
  }

  // September - check if before Labor Day (first Monday)
  if (month === 8) {
    // Find first Monday of September
    const firstOfSept = new Date(date.getFullYear(), 8, 1);
    const dayOfWeek = firstOfSept.getDay();
    const laborDay = dayOfWeek === 1 ? 1 : dayOfWeek === 0 ? 2 : 1 + (8 - dayOfWeek);
    return day < laborDay;
  }

  return false;
}

/**
 * Check if time range overlaps with school hours.
 */
function overlapsSchoolHours(startTime: string, endTime: string): boolean {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);

  // Work overlaps school hours if:
  // - Work starts during school hours (start >= 7 AM and start < 3 PM)
  // - Work ends during school hours (end > 7 AM and end <= 3 PM)
  // - Work spans school hours (start < 7 AM and end > 3 PM)
  return !(end <= SCHOOL_START || start >= SCHOOL_END);
}

/**
 * Check if an entry is a school night (night before a school day).
 */
function isSchoolNight(date: string, context: ComplianceContext): boolean {
  // Find the next day
  const dateObj = new Date(date + 'T00:00:00');
  dateObj.setDate(dateObj.getDate() + 1);
  const nextDateStr = dateObj.toISOString().split('T')[0]!;

  // Check if next day is a school day
  // First check if there are entries for that day
  const nextDayEntries = context.dailyEntries.get(nextDateStr);
  if (nextDayEntries && nextDayEntries.some((e) => e.isSchoolDay)) {
    return true;
  }

  // If no entries for next day, it might still be a school day
  // For simplicity, we'll assume if the current day is a school day,
  // Mon-Thu are school nights (before Tue-Fri)
  const dayOfWeek = new Date(date + 'T00:00:00').getDay();
  const currentDayEntries = context.dailyEntries.get(date);
  const _isCurrentSchoolDay = currentDayEntries?.some((e) => e.isSchoolDay) ?? false;

  // If it's a school week and Mon-Thu, treat as school night
  if (context.isSchoolWeek && dayOfWeek >= 1 && dayOfWeek <= 4) {
    return true;
  }

  // Sunday (0) before a school Monday
  if (context.isSchoolWeek && dayOfWeek === 0) {
    return true;
  }

  return false;
}

interface TimeViolation {
  date: string;
  entryId: string;
  startTime: string;
  endTime: string;
}

/**
 * RULE-004: Ages 12-13 school hours prohibition.
 */
export const schoolHours12_13Rule: ComplianceRule = {
  id: 'RULE-004',
  name: 'Ages 12-13 School Hours Prohibition',
  category: 'time_window',
  appliesToAgeBands: ['12-13'],

  evaluate: (context: ComplianceContext): RuleResult => {
    const violations: TimeViolation[] = [];

    for (const [date, entries] of context.dailyEntries) {
      const ageBand = context.dailyAgeBands.get(date);
      if (ageBand !== '12-13') continue;

      const isSchoolDay = entries.some((e) => e.isSchoolDay);
      if (!isSchoolDay) continue;

      for (const entry of entries) {
        if (overlapsSchoolHours(entry.startTime, entry.endTime)) {
          violations.push({
            date,
            entryId: entry.id,
            startTime: entry.startTime,
            endTime: entry.endTime,
          });
        }
      }
    }

    if (violations.length === 0) {
      return {
        ruleId: 'RULE-004',
        ruleName: 'Ages 12-13 School Hours Prohibition',
        result: 'pass',
        details: {
          ruleDescription:
            'Ages 12-13 cannot work during school hours (7 AM - 3 PM) on school days',
        },
      };
    }

    const first = violations[0]!;
    return {
      ruleId: 'RULE-004',
      ruleName: 'Ages 12-13 School Hours Prohibition',
      result: 'fail',
      details: {
        ruleDescription: 'Ages 12-13 cannot work during school hours (7 AM - 3 PM) on school days',
        checkedValues: { violations },
        affectedDates: [...new Set(violations.map((v) => v.date))],
        affectedEntries: violations.map((v) => v.entryId),
        message: RULE_004_MESSAGE.message(first.date, first.startTime, first.endTime),
      },
      errorMessage: RULE_004_MESSAGE.message(first.date, first.startTime, first.endTime),
      remediationGuidance: RULE_004_MESSAGE.remediation,
    };
  },
};

/**
 * RULE-010: Ages 14-15 school hours prohibition.
 */
export const schoolHours14_15Rule: ComplianceRule = {
  id: 'RULE-010',
  name: 'Ages 14-15 School Hours Prohibition',
  category: 'time_window',
  appliesToAgeBands: ['14-15'],

  evaluate: (context: ComplianceContext): RuleResult => {
    const violations: TimeViolation[] = [];

    for (const [date, entries] of context.dailyEntries) {
      const ageBand = context.dailyAgeBands.get(date);
      if (ageBand !== '14-15') continue;

      const isSchoolDay = entries.some((e) => e.isSchoolDay);
      if (!isSchoolDay) continue;

      for (const entry of entries) {
        if (overlapsSchoolHours(entry.startTime, entry.endTime)) {
          violations.push({
            date,
            entryId: entry.id,
            startTime: entry.startTime,
            endTime: entry.endTime,
          });
        }
      }
    }

    if (violations.length === 0) {
      return {
        ruleId: 'RULE-010',
        ruleName: 'Ages 14-15 School Hours Prohibition',
        result: 'pass',
        details: {
          ruleDescription:
            'Ages 14-15 cannot work during school hours (7 AM - 3 PM) on school days',
        },
      };
    }

    const first = violations[0]!;
    return {
      ruleId: 'RULE-010',
      ruleName: 'Ages 14-15 School Hours Prohibition',
      result: 'fail',
      details: {
        ruleDescription: 'Ages 14-15 cannot work during school hours (7 AM - 3 PM) on school days',
        checkedValues: { violations },
        affectedDates: [...new Set(violations.map((v) => v.date))],
        affectedEntries: violations.map((v) => v.entryId),
        message: RULE_010_MESSAGE.message(first.date, first.startTime, first.endTime),
      },
      errorMessage: RULE_010_MESSAGE.message(first.date, first.startTime, first.endTime),
      remediationGuidance: RULE_010_MESSAGE.remediation,
    };
  },
};

/**
 * RULE-011: Ages 14-15 work window (7 AM - 7 PM, extended to 9 PM Jun-Labor Day).
 */
export const workWindow14_15Rule: ComplianceRule = {
  id: 'RULE-011',
  name: 'Ages 14-15 Work Window',
  category: 'time_window',
  appliesToAgeBands: ['14-15'],

  evaluate: (context: ComplianceContext): RuleResult => {
    const violations: (TimeViolation & { windowEnd: string; isSummer: boolean })[] = [];

    for (const [date, entries] of context.dailyEntries) {
      const ageBand = context.dailyAgeBands.get(date);
      if (ageBand !== '14-15') continue;

      const isSummer = isSummerPeriod(date);
      const windowEnd = isSummer ? WINDOW_14_15_END_SUMMER : WINDOW_14_15_END_REGULAR;
      const windowEndStr = isSummer ? '9:00 PM' : '7:00 PM';

      for (const entry of entries) {
        const start = timeToMinutes(entry.startTime);
        const end = timeToMinutes(entry.endTime);

        // Check if outside 7 AM - 7/9 PM window
        if (start < WINDOW_14_15_START || end > windowEnd) {
          violations.push({
            date,
            entryId: entry.id,
            startTime: entry.startTime,
            endTime: entry.endTime,
            windowEnd: windowEndStr,
            isSummer,
          });
        }
      }
    }

    if (violations.length === 0) {
      return {
        ruleId: 'RULE-011',
        ruleName: 'Ages 14-15 Work Window',
        result: 'pass',
        details: {
          ruleDescription: 'Ages 14-15 may only work 7 AM - 7 PM (9 PM summer)',
        },
      };
    }

    const first = violations[0]!;
    return {
      ruleId: 'RULE-011',
      ruleName: 'Ages 14-15 Work Window',
      result: 'fail',
      details: {
        ruleDescription: 'Ages 14-15 may only work 7 AM - 7 PM (9 PM summer)',
        checkedValues: { violations },
        affectedDates: [...new Set(violations.map((v) => v.date))],
        affectedEntries: violations.map((v) => v.entryId),
        message: RULE_011_MESSAGE.message(
          first.date,
          first.endTime,
          first.windowEnd,
          first.isSummer
        ),
      },
      errorMessage: RULE_011_MESSAGE.message(
        first.date,
        first.endTime,
        first.windowEnd,
        first.isSummer
      ),
      remediationGuidance: RULE_011_MESSAGE.remediation(first.windowEnd),
    };
  },
};

/**
 * RULE-016: Ages 16-17 school night restriction (10 PM on nights before school).
 */
export const schoolNight16_17Rule: ComplianceRule = {
  id: 'RULE-016',
  name: 'Ages 16-17 School Night Restriction',
  category: 'time_window',
  appliesToAgeBands: ['16-17'],

  evaluate: (context: ComplianceContext): RuleResult => {
    const violations: TimeViolation[] = [];

    for (const [date, entries] of context.dailyEntries) {
      const ageBand = context.dailyAgeBands.get(date);
      if (ageBand !== '16-17') continue;

      // Only check school nights
      if (!isSchoolNight(date, context)) continue;

      for (const entry of entries) {
        const end = timeToMinutes(entry.endTime);

        if (end > WINDOW_16_17_END_SCHOOL_NIGHT) {
          violations.push({
            date,
            entryId: entry.id,
            startTime: entry.startTime,
            endTime: entry.endTime,
          });
        }
      }
    }

    if (violations.length === 0) {
      return {
        ruleId: 'RULE-016',
        ruleName: 'Ages 16-17 School Night Restriction',
        result: 'pass',
        details: {
          ruleDescription: 'Ages 16-17 cannot work past 10 PM on nights before school days',
        },
      };
    }

    const first = violations[0]!;
    return {
      ruleId: 'RULE-016',
      ruleName: 'Ages 16-17 School Night Restriction',
      result: 'fail',
      details: {
        ruleDescription: 'Ages 16-17 cannot work past 10 PM on nights before school days',
        checkedValues: { violations },
        affectedDates: [...new Set(violations.map((v) => v.date))],
        affectedEntries: violations.map((v) => v.entryId),
        message: RULE_016_MESSAGE.message(first.date, first.endTime),
      },
      errorMessage: RULE_016_MESSAGE.message(first.date, first.endTime),
      remediationGuidance: RULE_016_MESSAGE.remediation,
    };
  },
};

/**
 * RULE-017: Ages 16-17 work window (6 AM - 11:30 PM on non-school nights).
 */
export const workWindow16_17Rule: ComplianceRule = {
  id: 'RULE-017',
  name: 'Ages 16-17 Work Window',
  category: 'time_window',
  appliesToAgeBands: ['16-17'],

  evaluate: (context: ComplianceContext): RuleResult => {
    const violations: TimeViolation[] = [];

    for (const [date, entries] of context.dailyEntries) {
      const ageBand = context.dailyAgeBands.get(date);
      if (ageBand !== '16-17') continue;

      // Determine end limit based on school night
      const schoolNight = isSchoolNight(date, context);
      const endLimit = schoolNight
        ? WINDOW_16_17_END_SCHOOL_NIGHT
        : WINDOW_16_17_END_NONSCHOOL_NIGHT;

      for (const entry of entries) {
        const start = timeToMinutes(entry.startTime);
        const end = timeToMinutes(entry.endTime);

        // Check start time (always 6 AM)
        if (start < WINDOW_16_17_START) {
          violations.push({
            date,
            entryId: entry.id,
            startTime: entry.startTime,
            endTime: entry.endTime,
          });
          continue;
        }

        // Check end time on non-school nights (school nights handled by RULE-016)
        if (!schoolNight && end > endLimit) {
          violations.push({
            date,
            entryId: entry.id,
            startTime: entry.startTime,
            endTime: entry.endTime,
          });
        }
      }
    }

    if (violations.length === 0) {
      return {
        ruleId: 'RULE-017',
        ruleName: 'Ages 16-17 Work Window',
        result: 'pass',
        details: {
          ruleDescription: 'Ages 16-17 may only work 6 AM - 11:30 PM (10 PM on school nights)',
        },
      };
    }

    const first = violations[0]!;
    return {
      ruleId: 'RULE-017',
      ruleName: 'Ages 16-17 Work Window',
      result: 'fail',
      details: {
        ruleDescription: 'Ages 16-17 may only work 6 AM - 11:30 PM (10 PM on school nights)',
        checkedValues: { violations },
        affectedDates: [...new Set(violations.map((v) => v.date))],
        affectedEntries: violations.map((v) => v.entryId),
        message: RULE_017_MESSAGE.message(first.date, first.startTime, first.endTime),
      },
      errorMessage: RULE_017_MESSAGE.message(first.date, first.startTime, first.endTime),
      remediationGuidance: RULE_017_MESSAGE.remediation,
    };
  },
};

/**
 * RULE-034: Ages 16-17 school hours prohibition.
 */
export const schoolHours16_17Rule: ComplianceRule = {
  id: 'RULE-034',
  name: 'Ages 16-17 School Hours Prohibition',
  category: 'time_window',
  appliesToAgeBands: ['16-17'],

  evaluate: (context: ComplianceContext): RuleResult => {
    const violations: TimeViolation[] = [];

    for (const [date, entries] of context.dailyEntries) {
      const ageBand = context.dailyAgeBands.get(date);
      if (ageBand !== '16-17') continue;

      const isSchoolDay = entries.some((e) => e.isSchoolDay);
      if (!isSchoolDay) continue;

      for (const entry of entries) {
        if (overlapsSchoolHours(entry.startTime, entry.endTime)) {
          violations.push({
            date,
            entryId: entry.id,
            startTime: entry.startTime,
            endTime: entry.endTime,
          });
        }
      }
    }

    if (violations.length === 0) {
      return {
        ruleId: 'RULE-034',
        ruleName: 'Ages 16-17 School Hours Prohibition',
        result: 'pass',
        details: {
          ruleDescription:
            'Ages 16-17 cannot work during school hours (7 AM - 3 PM) on school days',
        },
      };
    }

    const first = violations[0]!;
    return {
      ruleId: 'RULE-034',
      ruleName: 'Ages 16-17 School Hours Prohibition',
      result: 'fail',
      details: {
        ruleDescription: 'Ages 16-17 cannot work during school hours (7 AM - 3 PM) on school days',
        checkedValues: { violations },
        affectedDates: [...new Set(violations.map((v) => v.date))],
        affectedEntries: violations.map((v) => v.entryId),
        message: RULE_034_MESSAGE.message(first.date, first.startTime, first.endTime),
      },
      errorMessage: RULE_034_MESSAGE.message(first.date, first.startTime, first.endTime),
      remediationGuidance: RULE_034_MESSAGE.remediation,
    };
  },
};

/**
 * All time window rules.
 */
export const timeWindowRules: ComplianceRule[] = [
  schoolHours12_13Rule,
  schoolHours14_15Rule,
  workWindow14_15Rule,
  schoolNight16_17Rule,
  workWindow16_17Rule,
  schoolHours16_17Rule,
];
