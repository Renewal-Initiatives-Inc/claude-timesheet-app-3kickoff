import { eq } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { hashPassword, verifyPassword, validatePasswordStrength } from '../utils/password.js';
import { createSession, revokeSession, revokeAllSessions } from './session.service.js';
import { env } from '../config/env.js';

const { employees } = schema;

export type Employee = typeof employees.$inferSelect;

export interface EmployeePublic {
  id: string;
  name: string;
  email: string;
  isSupervisor: boolean;
  dateOfBirth: string;
  status: 'active' | 'archived';
  createdAt: Date;
}

export interface RegisterData {
  name: string;
  email: string;
  dateOfBirth: string;
  isSupervisor?: boolean;
  tempPassword: string;
}

export interface LoginResult {
  token: string;
  employee: EmployeePublic;
}

export interface AccountLockStatus {
  locked: boolean;
  until?: Date;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public code: 'INVALID_CREDENTIALS' | 'ACCOUNT_LOCKED' | 'PASSWORD_TOO_WEAK' | 'EMAIL_EXISTS' | 'EMPLOYEE_NOT_FOUND'
  ) {
    super(message);
    this.name = 'AuthError';
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
    createdAt: employee.createdAt,
  };
}

/**
 * Register a new employee account.
 * Called by supervisors to create accounts for new employees.
 */
export async function register(data: RegisterData): Promise<EmployeePublic> {
  // Validate password strength
  const passwordValidation = validatePasswordStrength(data.tempPassword);
  if (!passwordValidation.valid) {
    throw new AuthError(passwordValidation.errors.join(', '), 'PASSWORD_TOO_WEAK');
  }

  // Check if email already exists
  const existing = await db.query.employees.findFirst({
    where: eq(employees.email, data.email.toLowerCase()),
  });

  if (existing) {
    throw new AuthError('An account with this email already exists', 'EMAIL_EXISTS');
  }

  // Hash the password
  const passwordHash = await hashPassword(data.tempPassword);

  // Create employee
  const [employee] = await db
    .insert(employees)
    .values({
      name: data.name,
      email: data.email.toLowerCase(),
      dateOfBirth: data.dateOfBirth,
      isSupervisor: data.isSupervisor ?? false,
      passwordHash,
      failedLoginAttempts: 0,
    })
    .returning();

  return toPublic(employee!);
}

/**
 * Login with email and password.
 * Returns JWT token and employee info on success.
 * Implements account lockout after MAX_LOGIN_ATTEMPTS failed attempts.
 */
export async function login(email: string, password: string): Promise<LoginResult> {
  const employee = await db.query.employees.findFirst({
    where: eq(employees.email, email.toLowerCase()),
  });

  if (!employee) {
    // Don't reveal whether email exists
    throw new AuthError('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  // Check if account is locked
  const lockStatus = checkAccountLocked(employee);
  if (lockStatus.locked) {
    throw new AuthError(
      `Account is locked until ${lockStatus.until!.toISOString()}`,
      'ACCOUNT_LOCKED'
    );
  }

  // Check if employee has a password set
  if (!employee.passwordHash) {
    throw new AuthError('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  // Verify password
  const passwordValid = await verifyPassword(password, employee.passwordHash);

  if (!passwordValid) {
    // Increment failed attempts and potentially lock account
    await incrementFailedAttempts(employee);
    throw new AuthError('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  // Successful login - reset failed attempts
  await resetFailedAttempts(employee.id);

  // Create session
  const { token } = await createSession(employee.id);

  return {
    token,
    employee: toPublic(employee),
  };
}

/**
 * Logout by revoking the session.
 */
export async function logout(token: string): Promise<void> {
  await revokeSession(token);
}

/**
 * Check if an employee account is locked.
 */
function checkAccountLocked(employee: Employee): AccountLockStatus {
  if (!employee.lockedUntil) {
    return { locked: false };
  }

  const now = new Date();
  if (employee.lockedUntil > now) {
    return { locked: true, until: employee.lockedUntil };
  }

  return { locked: false };
}

/**
 * Check if an account is locked by employee ID.
 */
export async function checkAccountLockedById(employeeId: string): Promise<AccountLockStatus> {
  const employee = await db.query.employees.findFirst({
    where: eq(employees.id, employeeId),
  });

  if (!employee) {
    throw new AuthError('Employee not found', 'EMPLOYEE_NOT_FOUND');
  }

  return checkAccountLocked(employee);
}

/**
 * Increment failed login attempts and lock account if threshold reached.
 */
async function incrementFailedAttempts(employee: Employee): Promise<void> {
  const newAttempts = (employee.failedLoginAttempts ?? 0) + 1;

  let lockedUntil: Date | null = null;
  if (newAttempts >= env.MAX_LOGIN_ATTEMPTS) {
    lockedUntil = new Date();
    lockedUntil.setMinutes(lockedUntil.getMinutes() + env.LOCKOUT_DURATION_MINUTES);
  }

  await db
    .update(employees)
    .set({
      failedLoginAttempts: newAttempts,
      lockedUntil,
      updatedAt: new Date(),
    })
    .where(eq(employees.id, employee.id));
}

/**
 * Reset failed login attempts after successful login.
 */
export async function resetFailedAttempts(employeeId: string): Promise<void> {
  await db
    .update(employees)
    .set({
      failedLoginAttempts: 0,
      lockedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(employees.id, employeeId));
}

/**
 * Change password for an employee.
 * Revokes all existing sessions after password change.
 */
export async function changePassword(employeeId: string, newPassword: string): Promise<void> {
  // Validate password strength
  const passwordValidation = validatePasswordStrength(newPassword);
  if (!passwordValidation.valid) {
    throw new AuthError(passwordValidation.errors.join(', '), 'PASSWORD_TOO_WEAK');
  }

  const passwordHash = await hashPassword(newPassword);

  await db
    .update(employees)
    .set({
      passwordHash,
      failedLoginAttempts: 0,
      lockedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(employees.id, employeeId));

  // Revoke all existing sessions for security
  await revokeAllSessions(employeeId);
}

/**
 * Get an employee by ID (public info only).
 */
export async function getEmployeeById(employeeId: string): Promise<EmployeePublic | null> {
  const employee = await db.query.employees.findFirst({
    where: eq(employees.id, employeeId),
  });

  if (!employee) {
    return null;
  }

  return toPublic(employee);
}
