/**
 * Compensation Service
 *
 * Reads employee compensation data from the app-portal database.
 * Used at payroll calculation time to determine pay for salaried
 * employees (PER_TASK employees continue using task_code_rates).
 *
 * Key rule: SALARIED employees earn a fixed weekly pay (annual_salary / 52),
 * regardless of hours worked. Hours are used for fund allocation only.
 */

import { eq } from 'drizzle-orm';
import { portalDb, portalEmployees } from '../db/app-portal.js';
import { db, schema } from '../db/index.js';
import Decimal from 'decimal.js';

type DecimalValue = InstanceType<typeof Decimal>;

const { employees } = schema;

// ─── Constants ──────────────────────────────────────────────────────

/** FLSA minimum weekly salary for exempt classification ($35,568/yr) */
const FLSA_EXEMPT_WEEKLY_THRESHOLD = new Decimal('684');

const WEEKS_PER_YEAR = new Decimal('52');

// ─── Types ──────────────────────────────────────────────────────────

export type CompensationType = 'PER_TASK' | 'SALARIED';
export type ExemptStatus = 'EXEMPT' | 'NON_EXEMPT';

export interface EmployeeCompensation {
  portalEmployeeId: string;
  compensationType: CompensationType;
  annualSalary: string | null; // decimal string
  expectedAnnualHours: number | null;
  exemptStatus: ExemptStatus;
  weeklyPay: string | null; // decimal string, only for SALARIED (annual_salary / 52)
}

export interface SalariedPayData {
  weeklyPay: DecimalValue;
  annualSalary: DecimalValue;
  exemptStatus: ExemptStatus;
  warnings: string[];
}

// ─── Errors ─────────────────────────────────────────────────────────

export type CompensationErrorCode =
  | 'PORTAL_DB_NOT_CONFIGURED'
  | 'EMPLOYEE_NOT_FOUND'
  | 'PORTAL_EMPLOYEE_NOT_FOUND'
  | 'MISSING_SALARY_DATA';

export class CompensationError extends Error {
  constructor(
    message: string,
    public code: CompensationErrorCode
  ) {
    super(message);
    this.name = 'CompensationError';
  }
}

// ─── Service Functions ──────────────────────────────────────────────

/**
 * Get compensation data for a local employee by looking up their
 * Zitadel ID in the app-portal database.
 *
 * Returns null if:
 * - The portal DB is not configured (graceful degradation)
 * - The employee has no zitadelId (legacy employee)
 * - The employee is not found in app-portal
 *
 * Throws CompensationError only for data integrity issues
 * (e.g., SALARIED but missing salary).
 */
export async function getEmployeeCompensation(
  localEmployeeId: string
): Promise<EmployeeCompensation | null> {
  if (!portalDb) {
    console.warn('Compensation lookup skipped: PEOPLE_DATABASE_URL not configured');
    return null;
  }

  // Look up the local employee's zitadelId
  const localEmployee = await db.query.employees.findFirst({
    where: eq(employees.id, localEmployeeId),
    columns: { id: true, zitadelId: true },
  });

  if (!localEmployee) {
    throw new CompensationError(
      `Local employee ${localEmployeeId} not found`,
      'EMPLOYEE_NOT_FOUND'
    );
  }

  if (!localEmployee.zitadelId) {
    // Legacy employee without SSO — fall back to task_code_rates
    return null;
  }

  // Query app-portal by zitadel_user_id
  const portalEmployee = await portalDb
    .select({
      id: portalEmployees.id,
      compensationType: portalEmployees.compensationType,
      annualSalary: portalEmployees.annualSalary,
      expectedAnnualHours: portalEmployees.expectedAnnualHours,
      exemptStatus: portalEmployees.exemptStatus,
    })
    .from(portalEmployees)
    .where(eq(portalEmployees.zitadelUserId, localEmployee.zitadelId))
    .limit(1);

  if (portalEmployee.length === 0) {
    // Employee exists locally but not in app-portal — fall back
    console.warn(
      `Employee ${localEmployeeId} (zitadel: ${localEmployee.zitadelId}) not found in app-portal`
    );
    return null;
  }

  const emp = portalEmployee[0]!;
  const compensationType = (emp.compensationType as CompensationType) || 'PER_TASK';
  const exemptStatus = (emp.exemptStatus as ExemptStatus) || 'NON_EXEMPT';

  let weeklyPay: string | null = null;

  if (compensationType === 'SALARIED') {
    if (!emp.annualSalary) {
      throw new CompensationError(
        `Salaried employee ${localEmployeeId} is missing annual_salary in app-portal`,
        'MISSING_SALARY_DATA'
      );
    }

    const salary = new Decimal(emp.annualSalary);
    weeklyPay = salary.dividedBy(WEEKS_PER_YEAR).toFixed(2);
  }

  return {
    portalEmployeeId: emp.id,
    compensationType,
    annualSalary: emp.annualSalary,
    expectedAnnualHours: emp.expectedAnnualHours,
    exemptStatus,
    weeklyPay,
  };
}

/**
 * Get salaried pay data for payroll calculation.
 *
 * Returns the fixed weekly pay amount, exempt status, and any
 * compliance warnings. Returns null for PER_TASK employees or
 * when comp data is unavailable (caller falls back to task_code_rates).
 */
export async function getSalariedWeeklyPay(
  localEmployeeId: string
): Promise<SalariedPayData | null> {
  const comp = await getEmployeeCompensation(localEmployeeId);

  if (!comp || comp.compensationType !== 'SALARIED' || !comp.weeklyPay) {
    return null;
  }

  const weeklyPay = new Decimal(comp.weeklyPay);
  const annualSalary = new Decimal(comp.annualSalary!);
  const warnings: string[] = [];

  // FLSA validation: EXEMPT requires salary >= $684/week
  if (comp.exemptStatus === 'EXEMPT' && weeklyPay.lessThan(FLSA_EXEMPT_WEEKLY_THRESHOLD)) {
    warnings.push(
      `FLSA warning: Employee is classified EXEMPT but weekly pay $${weeklyPay.toFixed(2)} ` +
        `is below the $${FLSA_EXEMPT_WEEKLY_THRESHOLD.toFixed(2)}/week threshold ($35,568/yr). ` +
        `This employee may not legally be exempt from overtime.`
    );
  }

  return {
    weeklyPay,
    annualSalary,
    exemptStatus: comp.exemptStatus,
    warnings,
  };
}
