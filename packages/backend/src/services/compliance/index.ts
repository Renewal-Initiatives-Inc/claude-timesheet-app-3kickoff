/**
 * Compliance Service - Main Entry Point.
 *
 * This module provides the public API for compliance checking:
 * - checkCompliance: Run all compliance checks and log results
 * - validateCompliance: Preview compliance without logging
 *
 * The service evaluates 37 compliance rules across categories:
 * - Documentation (parental consent, work permits, safety training)
 * - Hour limits (daily/weekly by age band)
 * - Time windows (school hours, work hours)
 * - Task restrictions (hazardous, age-appropriate)
 * - Break requirements (meal breaks)
 */

import {
  registerRules,
  clearRules,
  runComplianceCheck,
  validateCompliance,
  buildContext,
  ComplianceError,
} from './engine.js';

// Import all rule modules
import { documentationRules } from './rules/documentation.rules.js';
import { hourLimitRules } from './rules/hour-limits.rules.js';
import { timeWindowRules } from './rules/time-window.rules.js';
import { taskRestrictionRules } from './rules/task-restrictions.rules.js';
import { breakRules } from './rules/break-rules.js';

// Re-export types
export type {
  ComplianceRule,
  ComplianceContext,
  RuleResult,
  ComplianceCheckResult,
  ComplianceViolation,
  ComplianceCheckOptions,
  ComplianceResultType,
  RuleCategory,
  EmployeeDocument,
  ComplianceEmployee,
  RuleDetails,
} from './types.js';

// Re-export engine functions
export { registerRules, clearRules, buildContext, ComplianceError };

/**
 * Initialize compliance rules.
 * Must be called once at application startup.
 */
let initialized = false;

export function initializeComplianceRules(): void {
  if (initialized) return;

  // Clear any existing rules (for testing)
  clearRules();

  // Register all rule modules
  registerRules(documentationRules);
  registerRules(hourLimitRules);
  registerRules(timeWindowRules);
  registerRules(taskRestrictionRules);
  registerRules(breakRules);

  initialized = true;
}

/**
 * Reset initialization state (for testing).
 */
export function resetComplianceRules(): void {
  clearRules();
  initialized = false;
}

/**
 * Check compliance for a timesheet.
 *
 * This function:
 * 1. Builds context from the timesheet data
 * 2. Evaluates all applicable rules
 * 3. Logs results to the database for audit
 * 4. Returns pass/fail with detailed violation information
 *
 * @param timesheetId - The timesheet to check
 * @param options - Optional configuration
 * @returns Compliance check results
 */
export async function checkCompliance(
  timesheetId: string,
  options?: { stopOnFirstFailure?: boolean }
) {
  // Ensure rules are initialized
  initializeComplianceRules();

  return runComplianceCheck(timesheetId, options);
}

/**
 * Validate compliance without logging.
 *
 * Use this for preview/validation before submission.
 * Results are not logged to the database.
 *
 * @param timesheetId - The timesheet to validate
 * @returns Validation result with violations
 */
export async function previewCompliance(timesheetId: string) {
  // Ensure rules are initialized
  initializeComplianceRules();

  return validateCompliance(timesheetId);
}

/**
 * Get the count of registered rules.
 */
export async function getRuleCount(): Promise<number> {
  initializeComplianceRules();
  const { getRules } = await import('./engine.js');
  return getRules().length;
}
