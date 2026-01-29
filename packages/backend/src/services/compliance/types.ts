/**
 * Types and interfaces for the Compliance Rule Engine.
 *
 * This module defines the core abstractions for compliance checking:
 * - ComplianceRule: Individual rule definition with evaluation logic
 * - ComplianceContext: All data needed for rule evaluation
 * - RuleResult: Outcome of evaluating a single rule
 */

import type { AgeBand } from '../../utils/age.js';
import type { TimesheetWithEntries, TimesheetEntryWithTaskCode } from '../timesheet.service.js';

// Re-export for use by rule modules
export type { TimesheetEntryWithTaskCode };

/**
 * Categories of compliance rules.
 */
export type RuleCategory = 'documentation' | 'hours' | 'time_window' | 'task' | 'break';

/**
 * Result of evaluating a compliance rule.
 */
export type ComplianceResultType = 'pass' | 'fail' | 'not_applicable';

/**
 * Employee document from database.
 */
export interface EmployeeDocument {
  id: string;
  employeeId: string;
  type: 'parental_consent' | 'work_permit' | 'safety_training';
  filePath: string;
  uploadedAt: string;
  uploadedBy: string;
  expiresAt: string | null;
  invalidatedAt: string | null;
}

/**
 * Employee data needed for compliance checks.
 */
export interface ComplianceEmployee {
  id: string;
  name: string;
  email: string;
  dateOfBirth: string;
  isSupervisor: boolean;
}

/**
 * Details about a rule evaluation for audit logging.
 */
export interface RuleDetails {
  ruleDescription: string;
  checkedValues?: Record<string, unknown>;
  threshold?: number | string;
  actualValue?: number | string;
  affectedDates?: string[];
  affectedEntries?: string[];
  message?: string;
}

/**
 * Result of evaluating a single compliance rule.
 */
export interface RuleResult {
  ruleId: string;
  ruleName: string;
  result: ComplianceResultType;
  details: RuleDetails;
  errorMessage?: string;
  remediationGuidance?: string;
}

/**
 * Context provided to each rule for evaluation.
 * Contains all data needed to check compliance.
 */
export interface ComplianceContext {
  // Core entities
  employee: ComplianceEmployee;
  timesheet: TimesheetWithEntries;
  documents: EmployeeDocument[];

  // Pre-computed data for efficiency
  dailyAges: Map<string, number>; // date -> age on that date
  dailyAgeBands: Map<string, AgeBand>; // date -> age band on that date
  dailyHours: Map<string, number>; // date -> total hours
  dailyEntries: Map<string, TimesheetEntryWithTaskCode[]>; // date -> entries
  schoolDays: string[]; // dates marked as school days
  workDays: string[]; // dates with any entries
  weeklyTotal: number;
  isSchoolWeek: boolean; // true if any school day has entries
  checkDate: string; // YYYY-MM-DD when check is performed
}

/**
 * Definition of a compliance rule.
 */
export interface ComplianceRule {
  id: string;
  name: string;
  category: RuleCategory;
  /** Age bands this rule applies to. Empty array means all age bands. */
  appliesToAgeBands: AgeBand[];
  /** Evaluate the rule against the context. */
  evaluate: (context: ComplianceContext) => RuleResult;
}

/**
 * Overall result of running all compliance checks.
 */
export interface ComplianceCheckResult {
  passed: boolean;
  timesheetId: string;
  employeeId: string;
  checkedAt: string;
  results: RuleResult[];
  failedRules: RuleResult[];
  passedRules: RuleResult[];
  notApplicableRules: RuleResult[];
  /** User-facing error messages for failed rules. */
  violations: ComplianceViolation[];
}

/**
 * User-facing violation information.
 */
export interface ComplianceViolation {
  ruleId: string;
  ruleName: string;
  message: string;
  remediation: string;
  affectedDates?: string[];
  affectedEntries?: string[];
}

/**
 * Options for running compliance checks.
 */
export interface ComplianceCheckOptions {
  /** Stop evaluation after first failure. Default: false (evaluate all rules). */
  stopOnFirstFailure?: boolean;
}
