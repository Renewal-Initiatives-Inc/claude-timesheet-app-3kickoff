/**
 * Break Requirement Compliance Rules.
 *
 * These rules enforce meal break requirements:
 * - RULE-025: Meal break required for minors working >6 hours
 * - RULE-026: Meal break confirmation required (combined with RULE-025)
 */

import type { ComplianceRule, ComplianceContext, RuleResult } from '../types.js';
import { RULE_025_MESSAGE } from '../messages.js';

/**
 * Helper: Check if any age band in the week is a minor.
 */
function hasMinorAgeBand(context: ComplianceContext): boolean {
  for (const ageBand of context.dailyAgeBands.values()) {
    if (ageBand !== '18+') {
      return true;
    }
  }
  return false;
}

interface BreakViolation {
  date: string;
  hours: number;
  entryIds: string[];
}

/**
 * RULE-025 & RULE-026: Meal break required and confirmed for minors working >6 hours.
 */
export const mealBreakRule: ComplianceRule = {
  id: 'RULE-025',
  name: 'Meal Break Required',
  category: 'break',
  appliesToAgeBands: ['12-13', '14-15', '16-17'],

  evaluate: (context: ComplianceContext): RuleResult => {
    if (!hasMinorAgeBand(context)) {
      return {
        ruleId: 'RULE-025',
        ruleName: 'Meal Break Required',
        result: 'not_applicable',
        details: {
          ruleDescription: '30-minute meal break required for minors working more than 6 hours',
          checkedValues: { isMinor: false },
        },
      };
    }

    const violations: BreakViolation[] = [];

    // Check each day
    for (const [date, hours] of context.dailyHours) {
      const age = context.dailyAges.get(date);
      if (!age || age >= 18) continue;

      // Only check if worked more than 6 hours
      if (hours <= 6) continue;

      const entries = context.dailyEntries.get(date) ?? [];

      // Check if any entry has mealBreakConfirmed
      const hasBreakConfirmed = entries.some((e) => e.mealBreakConfirmed === true);

      if (!hasBreakConfirmed) {
        violations.push({
          date,
          hours,
          entryIds: entries.map((e) => e.id),
        });
      }
    }

    if (violations.length === 0) {
      return {
        ruleId: 'RULE-025',
        ruleName: 'Meal Break Required',
        result: 'pass',
        details: {
          ruleDescription: '30-minute meal break required for minors working more than 6 hours',
        },
      };
    }

    const first = violations[0]!;
    return {
      ruleId: 'RULE-025',
      ruleName: 'Meal Break Required',
      result: 'fail',
      details: {
        ruleDescription: '30-minute meal break required for minors working more than 6 hours',
        checkedValues: { violations },
        affectedDates: violations.map((v) => v.date),
        affectedEntries: violations.flatMap((v) => v.entryIds),
        message: RULE_025_MESSAGE.message(first.date, first.hours),
      },
      errorMessage: RULE_025_MESSAGE.message(first.date, first.hours),
      remediationGuidance: RULE_025_MESSAGE.remediation,
    };
  },
};

/**
 * All break rules.
 */
export const breakRules: ComplianceRule[] = [mealBreakRule];
