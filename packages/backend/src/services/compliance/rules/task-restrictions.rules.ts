/**
 * Task Restriction Compliance Rules.
 *
 * These rules enforce task-based restrictions:
 * - RULE-005: Ages 12-13 task age restriction
 * - RULE-012: Ages 14-15 task age restriction
 * - RULE-019: Ages 16-17 task age restriction
 * - RULE-020: Power machinery prohibition (all minors)
 * - RULE-021: Driving prohibition (all minors)
 * - RULE-022: Solo cash handling prohibition (under 14)
 * - RULE-024: Hazardous task prohibition (all minors)
 * - RULE-029: Supervisor attestation required
 */

import type { ComplianceRule, ComplianceContext, RuleResult } from '../types.js';
import {
  RULE_005_MESSAGE,
  RULE_020_MESSAGE,
  RULE_021_MESSAGE,
  RULE_022_MESSAGE,
  RULE_024_MESSAGE,
  RULE_029_MESSAGE,
} from '../messages.js';

interface TaskViolation {
  date: string;
  entryId: string;
  taskCode: string;
  taskName: string;
  employeeAge: number;
}

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

/**
 * RULE-005, RULE-012, RULE-019: Task age restriction.
 * Combined into a single rule that checks minAgeAllowed against employee age on each date.
 */
export const taskAgeRestrictionRule: ComplianceRule = {
  id: 'RULE-005',
  name: 'Task Age Restriction',
  category: 'task',
  appliesToAgeBands: ['12-13', '14-15', '16-17'],

  evaluate: (context: ComplianceContext): RuleResult => {
    if (!hasMinorAgeBand(context)) {
      return {
        ruleId: 'RULE-005',
        ruleName: 'Task Age Restriction',
        result: 'not_applicable',
        details: {
          ruleDescription: 'Task codes have minimum age requirements',
          checkedValues: { isMinor: false },
        },
      };
    }

    const violations: TaskViolation[] = [];

    for (const [date, entries] of context.dailyEntries) {
      const age = context.dailyAges.get(date);
      if (!age || age >= 18) continue;

      for (const entry of entries) {
        const minAge = entry.taskCode.minAgeAllowed;
        if (age < minAge) {
          violations.push({
            date,
            entryId: entry.id,
            taskCode: entry.taskCode.code,
            taskName: entry.taskCode.name,
            employeeAge: age,
          });
        }
      }
    }

    if (violations.length === 0) {
      return {
        ruleId: 'RULE-005',
        ruleName: 'Task Age Restriction',
        result: 'pass',
        details: {
          ruleDescription: 'Task codes have minimum age requirements',
        },
      };
    }

    const first = violations[0]!;
    // Find the minimum age for this task
    const minAge =
      context.dailyEntries.get(first.date)?.find((e) => e.id === first.entryId)?.taskCode
        .minAgeAllowed ?? 0;

    return {
      ruleId: 'RULE-005',
      ruleName: 'Task Age Restriction',
      result: 'fail',
      details: {
        ruleDescription: 'Task codes have minimum age requirements',
        checkedValues: { violations },
        affectedDates: [...new Set(violations.map((v) => v.date))],
        affectedEntries: violations.map((v) => v.entryId),
        message: RULE_005_MESSAGE.message(
          first.taskCode,
          first.taskName,
          minAge,
          first.employeeAge,
          first.date
        ),
      },
      errorMessage: RULE_005_MESSAGE.message(
        first.taskCode,
        first.taskName,
        minAge,
        first.employeeAge,
        first.date
      ),
      remediationGuidance: RULE_005_MESSAGE.remediation,
    };
  },
};

/**
 * RULE-020: Power machinery prohibition for minors.
 */
export const powerMachineryRule: ComplianceRule = {
  id: 'RULE-020',
  name: 'Power Machinery Prohibition',
  category: 'task',
  appliesToAgeBands: ['12-13', '14-15', '16-17'],

  evaluate: (context: ComplianceContext): RuleResult => {
    if (!hasMinorAgeBand(context)) {
      return {
        ruleId: 'RULE-020',
        ruleName: 'Power Machinery Prohibition',
        result: 'not_applicable',
        details: {
          ruleDescription: 'Power machinery prohibited for workers under 18',
          checkedValues: { isMinor: false },
        },
      };
    }

    const violations: TaskViolation[] = [];

    for (const [date, entries] of context.dailyEntries) {
      const age = context.dailyAges.get(date);
      if (!age || age >= 18) continue;

      for (const entry of entries) {
        if (entry.taskCode.powerMachinery) {
          violations.push({
            date,
            entryId: entry.id,
            taskCode: entry.taskCode.code,
            taskName: entry.taskCode.name,
            employeeAge: age,
          });
        }
      }
    }

    if (violations.length === 0) {
      return {
        ruleId: 'RULE-020',
        ruleName: 'Power Machinery Prohibition',
        result: 'pass',
        details: {
          ruleDescription: 'Power machinery prohibited for workers under 18',
        },
      };
    }

    const first = violations[0]!;
    return {
      ruleId: 'RULE-020',
      ruleName: 'Power Machinery Prohibition',
      result: 'fail',
      details: {
        ruleDescription: 'Power machinery prohibited for workers under 18',
        checkedValues: { violations },
        affectedDates: [...new Set(violations.map((v) => v.date))],
        affectedEntries: violations.map((v) => v.entryId),
        message: RULE_020_MESSAGE.message(first.taskCode, first.taskName),
      },
      errorMessage: RULE_020_MESSAGE.message(first.taskCode, first.taskName),
      remediationGuidance: RULE_020_MESSAGE.remediation,
    };
  },
};

/**
 * RULE-021: Driving prohibition for minors.
 */
export const drivingRule: ComplianceRule = {
  id: 'RULE-021',
  name: 'Driving Prohibition',
  category: 'task',
  appliesToAgeBands: ['12-13', '14-15', '16-17'],

  evaluate: (context: ComplianceContext): RuleResult => {
    if (!hasMinorAgeBand(context)) {
      return {
        ruleId: 'RULE-021',
        ruleName: 'Driving Prohibition',
        result: 'not_applicable',
        details: {
          ruleDescription: 'Driving prohibited for workers under 18',
          checkedValues: { isMinor: false },
        },
      };
    }

    const violations: TaskViolation[] = [];

    for (const [date, entries] of context.dailyEntries) {
      const age = context.dailyAges.get(date);
      if (!age || age >= 18) continue;

      for (const entry of entries) {
        if (entry.taskCode.drivingRequired) {
          violations.push({
            date,
            entryId: entry.id,
            taskCode: entry.taskCode.code,
            taskName: entry.taskCode.name,
            employeeAge: age,
          });
        }
      }
    }

    if (violations.length === 0) {
      return {
        ruleId: 'RULE-021',
        ruleName: 'Driving Prohibition',
        result: 'pass',
        details: {
          ruleDescription: 'Driving prohibited for workers under 18',
        },
      };
    }

    const first = violations[0]!;
    return {
      ruleId: 'RULE-021',
      ruleName: 'Driving Prohibition',
      result: 'fail',
      details: {
        ruleDescription: 'Driving prohibited for workers under 18',
        checkedValues: { violations },
        affectedDates: [...new Set(violations.map((v) => v.date))],
        affectedEntries: violations.map((v) => v.entryId),
        message: RULE_021_MESSAGE.message(first.taskCode, first.taskName),
      },
      errorMessage: RULE_021_MESSAGE.message(first.taskCode, first.taskName),
      remediationGuidance: RULE_021_MESSAGE.remediation,
    };
  },
};

/**
 * RULE-022: Solo cash handling prohibition for under 14.
 */
export const soloCashHandlingRule: ComplianceRule = {
  id: 'RULE-022',
  name: 'Solo Cash Handling Prohibition',
  category: 'task',
  appliesToAgeBands: ['12-13'],

  evaluate: (context: ComplianceContext): RuleResult => {
    const violations: TaskViolation[] = [];

    for (const [date, entries] of context.dailyEntries) {
      const age = context.dailyAges.get(date);
      if (!age || age >= 14) continue;

      for (const entry of entries) {
        if (entry.taskCode.soloCashHandling) {
          violations.push({
            date,
            entryId: entry.id,
            taskCode: entry.taskCode.code,
            taskName: entry.taskCode.name,
            employeeAge: age,
          });
        }
      }
    }

    if (violations.length === 0) {
      return {
        ruleId: 'RULE-022',
        ruleName: 'Solo Cash Handling Prohibition',
        result: 'pass',
        details: {
          ruleDescription: 'Solo cash handling prohibited for workers under 14',
        },
      };
    }

    const first = violations[0]!;
    return {
      ruleId: 'RULE-022',
      ruleName: 'Solo Cash Handling Prohibition',
      result: 'fail',
      details: {
        ruleDescription: 'Solo cash handling prohibited for workers under 14',
        checkedValues: { violations },
        affectedDates: [...new Set(violations.map((v) => v.date))],
        affectedEntries: violations.map((v) => v.entryId),
        message: RULE_022_MESSAGE.message(first.taskCode, first.taskName, first.employeeAge),
      },
      errorMessage: RULE_022_MESSAGE.message(first.taskCode, first.taskName, first.employeeAge),
      remediationGuidance: RULE_022_MESSAGE.remediation,
    };
  },
};

/**
 * RULE-024: Hazardous task prohibition for minors.
 */
export const hazardousTaskRule: ComplianceRule = {
  id: 'RULE-024',
  name: 'Hazardous Task Prohibition',
  category: 'task',
  appliesToAgeBands: ['12-13', '14-15', '16-17'],

  evaluate: (context: ComplianceContext): RuleResult => {
    if (!hasMinorAgeBand(context)) {
      return {
        ruleId: 'RULE-024',
        ruleName: 'Hazardous Task Prohibition',
        result: 'not_applicable',
        details: {
          ruleDescription: 'Hazardous tasks prohibited for workers under 18',
          checkedValues: { isMinor: false },
        },
      };
    }

    const violations: TaskViolation[] = [];

    for (const [date, entries] of context.dailyEntries) {
      const age = context.dailyAges.get(date);
      if (!age || age >= 18) continue;

      for (const entry of entries) {
        if (entry.taskCode.isHazardous) {
          violations.push({
            date,
            entryId: entry.id,
            taskCode: entry.taskCode.code,
            taskName: entry.taskCode.name,
            employeeAge: age,
          });
        }
      }
    }

    if (violations.length === 0) {
      return {
        ruleId: 'RULE-024',
        ruleName: 'Hazardous Task Prohibition',
        result: 'pass',
        details: {
          ruleDescription: 'Hazardous tasks prohibited for workers under 18',
        },
      };
    }

    const first = violations[0]!;
    return {
      ruleId: 'RULE-024',
      ruleName: 'Hazardous Task Prohibition',
      result: 'fail',
      details: {
        ruleDescription: 'Hazardous tasks prohibited for workers under 18',
        checkedValues: { violations },
        affectedDates: [...new Set(violations.map((v) => v.date))],
        affectedEntries: violations.map((v) => v.entryId),
        message: RULE_024_MESSAGE.message(first.taskCode, first.taskName),
      },
      errorMessage: RULE_024_MESSAGE.message(first.taskCode, first.taskName),
      remediationGuidance: RULE_024_MESSAGE.remediation,
    };
  },
};

/**
 * RULE-029: Supervisor attestation required for flagged tasks.
 */
export const supervisorAttestationRule: ComplianceRule = {
  id: 'RULE-029',
  name: 'Supervisor Attestation Required',
  category: 'task',
  appliesToAgeBands: ['12-13', '14-15', '16-17'],

  evaluate: (context: ComplianceContext): RuleResult => {
    if (!hasMinorAgeBand(context)) {
      return {
        ruleId: 'RULE-029',
        ruleName: 'Supervisor Attestation Required',
        result: 'not_applicable',
        details: {
          ruleDescription: 'Certain tasks require supervisor presence attestation for minors',
          checkedValues: { isMinor: false },
        },
      };
    }

    const violations: TaskViolation[] = [];

    for (const [date, entries] of context.dailyEntries) {
      const age = context.dailyAges.get(date);
      if (!age || age >= 18) continue;

      for (const entry of entries) {
        // Check if supervisor required
        const supervisorRequired = entry.taskCode.supervisorRequired;
        const needsSupervisor =
          supervisorRequired === 'always' || (supervisorRequired === 'for_minors' && age < 18);

        if (needsSupervisor) {
          // Check if supervisor name is provided
          if (!entry.supervisorPresentName || entry.supervisorPresentName.trim() === '') {
            violations.push({
              date,
              entryId: entry.id,
              taskCode: entry.taskCode.code,
              taskName: entry.taskCode.name,
              employeeAge: age,
            });
          }
        }
      }
    }

    if (violations.length === 0) {
      return {
        ruleId: 'RULE-029',
        ruleName: 'Supervisor Attestation Required',
        result: 'pass',
        details: {
          ruleDescription: 'Certain tasks require supervisor presence attestation for minors',
        },
      };
    }

    const first = violations[0]!;
    return {
      ruleId: 'RULE-029',
      ruleName: 'Supervisor Attestation Required',
      result: 'fail',
      details: {
        ruleDescription: 'Certain tasks require supervisor presence attestation for minors',
        checkedValues: { violations },
        affectedDates: [...new Set(violations.map((v) => v.date))],
        affectedEntries: violations.map((v) => v.entryId),
        message: RULE_029_MESSAGE.message(first.taskCode, first.taskName, first.date),
      },
      errorMessage: RULE_029_MESSAGE.message(first.taskCode, first.taskName, first.date),
      remediationGuidance: RULE_029_MESSAGE.remediation,
    };
  },
};

/**
 * All task restriction rules.
 */
export const taskRestrictionRules: ComplianceRule[] = [
  taskAgeRestrictionRule,
  powerMachineryRule,
  drivingRule,
  soloCashHandlingRule,
  hazardousTaskRule,
  supervisorAttestationRule,
];
