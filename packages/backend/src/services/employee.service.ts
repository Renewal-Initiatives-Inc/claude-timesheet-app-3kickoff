import { eq, and, like, or, ne } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { calculateAge, getAgeBand, type AgeBand } from '../utils/age.js';
import type {
  RequiredDocuments,
  EmployeePublic,
  EmployeeWithDocStatus,
} from '@renewal/types';

const { employees, employeeDocuments } = schema;

type Employee = typeof employees.$inferSelect;

const MIN_EMPLOYMENT_AGE = 12;

/**
 * Error thrown for employee-related business logic errors.
 */
export class EmployeeError extends Error {
  constructor(
    message: string,
    public code:
      | 'AGE_TOO_YOUNG'
      | 'EMPLOYEE_NOT_FOUND'
      | 'EMAIL_EXISTS'
      | 'INVALID_STATUS'
      | 'CANNOT_ARCHIVE_SELF'
  ) {
    super(message);
    this.name = 'EmployeeError';
  }
}

/**
 * Strip sensitive fields from employee record.
 */
function toPublic(employee: Employee): EmployeePublic {
  return {
    id: employee.id,
    name: employee.name,
    email: employee.email,
    isSupervisor: employee.isSupervisor,
    dateOfBirth: employee.dateOfBirth,
    status: employee.status,
    createdAt: employee.createdAt.toISOString(),
  };
}

/**
 * Validate age meets minimum requirement.
 *
 * @param dateOfBirth - Date of birth in YYYY-MM-DD format
 * @param asOfDate - Date to calculate age as of (defaults to current date)
 * @throws EmployeeError if age is below minimum
 */
export function validateEmployeeAge(
  dateOfBirth: string,
  asOfDate: Date = new Date()
): { age: number; ageBand: AgeBand } {
  const dateStr = asOfDate.toISOString().split('T')[0]!;
  const age = calculateAge(dateOfBirth, dateStr);

  if (age < MIN_EMPLOYMENT_AGE) {
    throw new EmployeeError(
      `Employee must be at least ${MIN_EMPLOYMENT_AGE} years old. Calculated age: ${age}`,
      'AGE_TOO_YOUNG'
    );
  }

  return {
    age,
    ageBand: getAgeBand(age),
  };
}

/**
 * Get required documents based on employee age.
 *
 * Business rules:
 * - Ages 12-13: Require parental consent with COPPA disclosure
 * - Ages 14-17: Require parental consent + work permit
 * - Ages 18+: No documentation required
 * - All minors require safety training
 *
 * @param age - Employee's current age
 * @returns Required documents configuration
 */
export function getRequiredDocuments(age: number): RequiredDocuments {
  if (age < MIN_EMPLOYMENT_AGE) {
    throw new EmployeeError(
      `Minimum employment age is ${MIN_EMPLOYMENT_AGE}`,
      'AGE_TOO_YOUNG'
    );
  }

  if (age <= 13) {
    // Ages 12-13: Parental consent with COPPA, safety training, no work permit
    return {
      parentalConsent: true,
      workPermit: false,
      safetyTraining: true,
      coppaDisclosure: true,
    };
  }

  if (age <= 17) {
    // Ages 14-17: Parental consent, work permit, safety training
    return {
      parentalConsent: true,
      workPermit: true,
      safetyTraining: true,
      coppaDisclosure: false,
    };
  }

  // Ages 18+: No documentation required
  return {
    parentalConsent: false,
    workPermit: false,
    safetyTraining: false,
    coppaDisclosure: false,
  };
}

/**
 * Get all employees with optional filters.
 *
 * @param options - Filter options
 * @returns List of employees with documentation status
 */
export async function listEmployees(options: {
  status?: 'active' | 'archived' | 'all';
  search?: string;
}): Promise<EmployeeWithDocStatus[]> {
  const { status = 'active', search } = options;

  // Build where conditions
  const conditions = [];

  if (status !== 'all') {
    conditions.push(eq(employees.status, status));
  }

  if (search) {
    const searchPattern = `%${search}%`;
    conditions.push(
      or(
        like(employees.name, searchPattern),
        like(employees.email, searchPattern)
      )
    );
  }

  const employeeList = await db.query.employees.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: (employees, { asc }) => [asc(employees.name)],
  });

  // Get document counts for each employee
  const results: EmployeeWithDocStatus[] = [];

  for (const employee of employeeList) {
    const age = calculateAge(employee.dateOfBirth, new Date().toISOString().split('T')[0]!);
    const ageBand = age >= MIN_EMPLOYMENT_AGE ? getAgeBand(age) : '18+'; // Fallback for edge cases
    const required = age >= MIN_EMPLOYMENT_AGE ? getRequiredDocuments(age) : getRequiredDocuments(18);

    // Get valid (non-invalidated, non-expired) documents
    const docs = await db.query.employeeDocuments.findMany({
      where: and(
        eq(employeeDocuments.employeeId, employee.id),
        eq(employeeDocuments.invalidatedAt, null as unknown as never)
      ),
    });

    // Filter out expired documents
    const today = new Date().toISOString().split('T')[0]!;
    const validDocs = docs.filter(
      (d) => !d.expiresAt || d.expiresAt >= today
    );

    // Count missing and expiring
    const requiredTypes: Array<'parental_consent' | 'work_permit' | 'safety_training'> = [];
    if (required.parentalConsent) requiredTypes.push('parental_consent');
    if (required.workPermit) requiredTypes.push('work_permit');
    if (required.safetyTraining) requiredTypes.push('safety_training');

    const hasDocOfType = (type: string) =>
      validDocs.some((d) => d.type === type);

    const missingCount = requiredTypes.filter((t) => !hasDocOfType(t)).length;

    // Count documents expiring within 30 days
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const expiringCount = validDocs.filter((d) => {
      if (!d.expiresAt) return false;
      const expires = new Date(d.expiresAt);
      return expires <= thirtyDaysFromNow;
    }).length;

    results.push({
      ...toPublic(employee),
      age,
      ageBand,
      documentation: {
        isComplete: missingCount === 0,
        missingCount,
        expiringCount,
      },
    });
  }

  return results;
}

/**
 * Get a single employee by ID.
 *
 * @param employeeId - Employee UUID
 * @returns Employee with documentation status or null if not found
 */
export async function getEmployeeById(
  employeeId: string
): Promise<EmployeeWithDocStatus | null> {
  const employee = await db.query.employees.findFirst({
    where: eq(employees.id, employeeId),
  });

  if (!employee) {
    return null;
  }

  const age = calculateAge(employee.dateOfBirth, new Date().toISOString().split('T')[0]!);
  const ageBand = age >= MIN_EMPLOYMENT_AGE ? getAgeBand(age) : '18+';
  const required = age >= MIN_EMPLOYMENT_AGE ? getRequiredDocuments(age) : getRequiredDocuments(18);

  // Get valid documents
  const docs = await db.query.employeeDocuments.findMany({
    where: eq(employeeDocuments.employeeId, employeeId),
  });

  const today = new Date().toISOString().split('T')[0]!;
  const validDocs = docs.filter(
    (d) => !d.invalidatedAt && (!d.expiresAt || d.expiresAt >= today)
  );

  const requiredTypes: string[] = [];
  if (required.parentalConsent) requiredTypes.push('parental_consent');
  if (required.workPermit) requiredTypes.push('work_permit');
  if (required.safetyTraining) requiredTypes.push('safety_training');

  const hasDocOfType = (type: string) =>
    validDocs.some((d) => d.type === type);

  const missingCount = requiredTypes.filter((t) => !hasDocOfType(t)).length;

  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const expiringCount = validDocs.filter((d) => {
    if (!d.expiresAt) return false;
    return new Date(d.expiresAt) <= thirtyDaysFromNow;
  }).length;

  return {
    ...toPublic(employee),
    age,
    ageBand,
    documentation: {
      isComplete: missingCount === 0,
      missingCount,
      expiringCount,
    },
  };
}

/**
 * Update an employee.
 * Note: Cannot change dateOfBirth or isSupervisor.
 *
 * @param employeeId - Employee UUID
 * @param data - Fields to update
 * @returns Updated employee
 */
export async function updateEmployee(
  employeeId: string,
  data: { name?: string; email?: string }
): Promise<EmployeePublic> {
  const employee = await db.query.employees.findFirst({
    where: eq(employees.id, employeeId),
  });

  if (!employee) {
    throw new EmployeeError('Employee not found', 'EMPLOYEE_NOT_FOUND');
  }

  // Check for email uniqueness if changing email
  if (data.email && data.email.toLowerCase() !== employee.email.toLowerCase()) {
    const existingEmail = await db.query.employees.findFirst({
      where: and(
        eq(employees.email, data.email.toLowerCase()),
        ne(employees.id, employeeId)
      ),
    });

    if (existingEmail) {
      throw new EmployeeError(
        'An account with this email already exists',
        'EMAIL_EXISTS'
      );
    }
  }

  const updates: Partial<typeof employees.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (data.name) {
    updates.name = data.name;
  }

  if (data.email) {
    updates.email = data.email.toLowerCase();
  }

  const [updated] = await db
    .update(employees)
    .set(updates)
    .where(eq(employees.id, employeeId))
    .returning();

  return toPublic(updated!);
}

/**
 * Archive an employee (soft delete).
 *
 * @param employeeId - Employee UUID
 * @param requestingEmployeeId - ID of the employee making the request
 */
export async function archiveEmployee(
  employeeId: string,
  requestingEmployeeId: string
): Promise<void> {
  if (employeeId === requestingEmployeeId) {
    throw new EmployeeError('Cannot archive your own account', 'CANNOT_ARCHIVE_SELF');
  }

  const employee = await db.query.employees.findFirst({
    where: eq(employees.id, employeeId),
  });

  if (!employee) {
    throw new EmployeeError('Employee not found', 'EMPLOYEE_NOT_FOUND');
  }

  if (employee.status === 'archived') {
    throw new EmployeeError('Employee is already archived', 'INVALID_STATUS');
  }

  await db
    .update(employees)
    .set({
      status: 'archived',
      updatedAt: new Date(),
    })
    .where(eq(employees.id, employeeId));
}

/**
 * Get all documents for an employee.
 *
 * @param employeeId - Employee UUID
 * @returns List of documents
 */
export async function getEmployeeDocuments(employeeId: string) {
  const employee = await db.query.employees.findFirst({
    where: eq(employees.id, employeeId),
  });

  if (!employee) {
    throw new EmployeeError('Employee not found', 'EMPLOYEE_NOT_FOUND');
  }

  const docs = await db.query.employeeDocuments.findMany({
    where: eq(employeeDocuments.employeeId, employeeId),
    orderBy: (docs, { desc }) => [desc(docs.uploadedAt)],
  });

  return docs.map((d) => ({
    id: d.id,
    employeeId: d.employeeId,
    type: d.type,
    filePath: d.filePath,
    uploadedAt: d.uploadedAt.toISOString(),
    uploadedBy: d.uploadedBy,
    expiresAt: d.expiresAt,
    invalidatedAt: d.invalidatedAt?.toISOString() ?? null,
  }));
}
