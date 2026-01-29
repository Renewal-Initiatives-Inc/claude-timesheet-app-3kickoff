/**
 * Documentation Compliance Rules.
 *
 * These rules check that required documents are on file:
 * - RULE-001: Parental consent required for minors
 * - RULE-006: COPPA disclosure (included in parental consent for 12-13)
 * - RULE-007: Parental consent not revoked
 * - RULE-027: Work permit required for ages 14-17
 * - RULE-028: Work permit not expired
 * - RULE-030: Safety training required for minors
 */

import type { ComplianceRule, ComplianceContext, RuleResult } from '../types.js';
import {
  RULE_001_MESSAGE,
  RULE_007_MESSAGE,
  RULE_027_MESSAGE,
  RULE_028_MESSAGE,
  RULE_030_MESSAGE,
} from '../messages.js';

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
 * Helper: Check if any age in the week requires work permit (14-17).
 */
function requiresWorkPermit(context: ComplianceContext): boolean {
  for (const age of context.dailyAges.values()) {
    if (age >= 14 && age < 18) {
      return true;
    }
  }
  return false;
}

/**
 * Helper: Get valid parental consent document.
 */
function getValidParentalConsent(context: ComplianceContext) {
  return context.documents.find((d) => d.type === 'parental_consent' && d.invalidatedAt === null);
}

/**
 * Helper: Get valid work permit document.
 */
function _getValidWorkPermit(context: ComplianceContext) {
  const today = context.checkDate;
  return context.documents.find(
    (d) =>
      d.type === 'work_permit' &&
      d.invalidatedAt === null &&
      (d.expiresAt === null || d.expiresAt >= today)
  );
}

/**
 * Helper: Get safety training document.
 */
function getSafetyTraining(context: ComplianceContext) {
  return context.documents.find((d) => d.type === 'safety_training' && d.invalidatedAt === null);
}

/**
 * RULE-001 & RULE-006: Parental consent required for minors.
 * COPPA disclosure is included in the consent form itself for ages 12-13.
 */
export const parentalConsentRule: ComplianceRule = {
  id: 'RULE-001',
  name: 'Parental Consent Required',
  category: 'documentation',
  appliesToAgeBands: ['12-13', '14-15', '16-17'],

  evaluate: (context: ComplianceContext): RuleResult => {
    // Check if employee is a minor
    if (!hasMinorAgeBand(context)) {
      return {
        ruleId: 'RULE-001',
        ruleName: 'Parental Consent Required',
        result: 'not_applicable',
        details: {
          ruleDescription: 'Parental consent required for workers under 18',
          checkedValues: { isMinor: false },
        },
      };
    }

    const consent = getValidParentalConsent(context);

    if (!consent) {
      return {
        ruleId: 'RULE-001',
        ruleName: 'Parental Consent Required',
        result: 'fail',
        details: {
          ruleDescription: 'Parental consent required for workers under 18',
          checkedValues: {
            hasConsent: false,
            employeeName: context.employee.name,
          },
          message: RULE_001_MESSAGE.message(context.employee.name),
        },
        errorMessage: RULE_001_MESSAGE.message(context.employee.name),
        remediationGuidance: RULE_001_MESSAGE.remediation,
      };
    }

    return {
      ruleId: 'RULE-001',
      ruleName: 'Parental Consent Required',
      result: 'pass',
      details: {
        ruleDescription: 'Parental consent required for workers under 18',
        checkedValues: {
          hasConsent: true,
          documentId: consent.id,
          uploadedAt: consent.uploadedAt,
        },
      },
    };
  },
};

/**
 * RULE-007: Parental consent not revoked.
 */
export const parentalConsentNotRevokedRule: ComplianceRule = {
  id: 'RULE-007',
  name: 'Parental Consent Not Revoked',
  category: 'documentation',
  appliesToAgeBands: ['12-13', '14-15', '16-17'],

  evaluate: (context: ComplianceContext): RuleResult => {
    if (!hasMinorAgeBand(context)) {
      return {
        ruleId: 'RULE-007',
        ruleName: 'Parental Consent Not Revoked',
        result: 'not_applicable',
        details: {
          ruleDescription: 'Parental consent must not be revoked',
          checkedValues: { isMinor: false },
        },
      };
    }

    // Check if there's any revoked consent
    const revokedConsent = context.documents.find(
      (d) => d.type === 'parental_consent' && d.invalidatedAt !== null
    );

    // Check if there's a valid consent
    const validConsent = getValidParentalConsent(context);

    // If there's a revoked consent and no valid replacement, fail
    if (revokedConsent && !validConsent) {
      return {
        ruleId: 'RULE-007',
        ruleName: 'Parental Consent Not Revoked',
        result: 'fail',
        details: {
          ruleDescription: 'Parental consent must not be revoked',
          checkedValues: {
            revokedAt: revokedConsent.invalidatedAt,
            hasValidReplacement: false,
          },
          message: RULE_007_MESSAGE.message(),
        },
        errorMessage: RULE_007_MESSAGE.message(),
        remediationGuidance: RULE_007_MESSAGE.remediation,
      };
    }

    return {
      ruleId: 'RULE-007',
      ruleName: 'Parental Consent Not Revoked',
      result: 'pass',
      details: {
        ruleDescription: 'Parental consent must not be revoked',
        checkedValues: {
          hasValidConsent: !!validConsent,
        },
      },
    };
  },
};

/**
 * RULE-027: Work permit required for ages 14-17.
 */
export const workPermitRequiredRule: ComplianceRule = {
  id: 'RULE-027',
  name: 'Work Permit Required',
  category: 'documentation',
  appliesToAgeBands: ['14-15', '16-17'],

  evaluate: (context: ComplianceContext): RuleResult => {
    if (!requiresWorkPermit(context)) {
      return {
        ruleId: 'RULE-027',
        ruleName: 'Work Permit Required',
        result: 'not_applicable',
        details: {
          ruleDescription: 'Work permit required for workers ages 14-17',
          checkedValues: { requiresPermit: false },
        },
      };
    }

    // Get the maximum age in the week (for message)
    let maxAge = 0;
    for (const age of context.dailyAges.values()) {
      if (age > maxAge) maxAge = age;
    }

    // Check for any work permit (not checking expiration here, that's RULE-028)
    const permit = context.documents.find(
      (d) => d.type === 'work_permit' && d.invalidatedAt === null
    );

    if (!permit) {
      return {
        ruleId: 'RULE-027',
        ruleName: 'Work Permit Required',
        result: 'fail',
        details: {
          ruleDescription: 'Work permit required for workers ages 14-17',
          checkedValues: {
            hasPermit: false,
            age: maxAge,
          },
          message: RULE_027_MESSAGE.message(maxAge),
        },
        errorMessage: RULE_027_MESSAGE.message(maxAge),
        remediationGuidance: RULE_027_MESSAGE.remediation,
      };
    }

    return {
      ruleId: 'RULE-027',
      ruleName: 'Work Permit Required',
      result: 'pass',
      details: {
        ruleDescription: 'Work permit required for workers ages 14-17',
        checkedValues: {
          hasPermit: true,
          documentId: permit.id,
        },
      },
    };
  },
};

/**
 * RULE-028: Work permit not expired.
 */
export const workPermitNotExpiredRule: ComplianceRule = {
  id: 'RULE-028',
  name: 'Work Permit Not Expired',
  category: 'documentation',
  appliesToAgeBands: ['14-15', '16-17'],

  evaluate: (context: ComplianceContext): RuleResult => {
    if (!requiresWorkPermit(context)) {
      return {
        ruleId: 'RULE-028',
        ruleName: 'Work Permit Not Expired',
        result: 'not_applicable',
        details: {
          ruleDescription: 'Work permit must not be expired',
          checkedValues: { requiresPermit: false },
        },
      };
    }

    const today = context.checkDate;

    // Find any non-revoked permit
    const permit = context.documents.find(
      (d) => d.type === 'work_permit' && d.invalidatedAt === null
    );

    // No permit at all - handled by RULE-027
    if (!permit) {
      return {
        ruleId: 'RULE-028',
        ruleName: 'Work Permit Not Expired',
        result: 'not_applicable',
        details: {
          ruleDescription: 'Work permit must not be expired',
          checkedValues: { hasPermit: false },
        },
      };
    }

    // Check expiration
    if (permit.expiresAt && permit.expiresAt < today) {
      return {
        ruleId: 'RULE-028',
        ruleName: 'Work Permit Not Expired',
        result: 'fail',
        details: {
          ruleDescription: 'Work permit must not be expired',
          checkedValues: {
            expiresAt: permit.expiresAt,
            checkDate: today,
          },
          message: RULE_028_MESSAGE.message(permit.expiresAt),
        },
        errorMessage: RULE_028_MESSAGE.message(permit.expiresAt),
        remediationGuidance: RULE_028_MESSAGE.remediation,
      };
    }

    return {
      ruleId: 'RULE-028',
      ruleName: 'Work Permit Not Expired',
      result: 'pass',
      details: {
        ruleDescription: 'Work permit must not be expired',
        checkedValues: {
          expiresAt: permit.expiresAt,
          isValid: true,
        },
      },
    };
  },
};

/**
 * RULE-030: Safety training required for minors.
 */
export const safetyTrainingRule: ComplianceRule = {
  id: 'RULE-030',
  name: 'Safety Training Required',
  category: 'documentation',
  appliesToAgeBands: ['12-13', '14-15', '16-17'],

  evaluate: (context: ComplianceContext): RuleResult => {
    if (!hasMinorAgeBand(context)) {
      return {
        ruleId: 'RULE-030',
        ruleName: 'Safety Training Required',
        result: 'not_applicable',
        details: {
          ruleDescription: 'Safety training required for workers under 18',
          checkedValues: { isMinor: false },
        },
      };
    }

    const training = getSafetyTraining(context);

    if (!training) {
      return {
        ruleId: 'RULE-030',
        ruleName: 'Safety Training Required',
        result: 'fail',
        details: {
          ruleDescription: 'Safety training required for workers under 18',
          checkedValues: {
            hasTraining: false,
          },
          message: RULE_030_MESSAGE.message(),
        },
        errorMessage: RULE_030_MESSAGE.message(),
        remediationGuidance: RULE_030_MESSAGE.remediation,
      };
    }

    return {
      ruleId: 'RULE-030',
      ruleName: 'Safety Training Required',
      result: 'pass',
      details: {
        ruleDescription: 'Safety training required for workers under 18',
        checkedValues: {
          hasTraining: true,
          documentId: training.id,
        },
      },
    };
  },
};

/**
 * All documentation rules.
 */
export const documentationRules: ComplianceRule[] = [
  parentalConsentRule,
  parentalConsentNotRevokedRule,
  workPermitRequiredRule,
  workPermitNotExpiredRule,
  safetyTrainingRule,
];
