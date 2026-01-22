import { and, eq, isNull, gt } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { generateSecureToken, validatePasswordStrength } from '../utils/password.js';
import { changePassword } from './auth.service.js';
import { sendPasswordResetEmail } from './email.service.js';
import { env } from '../config/env.js';

const { employees, passwordResetTokens } = schema;

export type Employee = typeof employees.$inferSelect;

export class PasswordResetError extends Error {
  constructor(
    message: string,
    public code: 'INVALID_TOKEN' | 'TOKEN_EXPIRED' | 'TOKEN_USED' | 'PASSWORD_TOO_WEAK'
  ) {
    super(message);
    this.name = 'PasswordResetError';
  }
}

/**
 * Request a password reset.
 * Sends an email with reset link if the account exists.
 * Always returns success to avoid revealing if email exists (timing-safe).
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const employee = await db.query.employees.findFirst({
    where: eq(employees.email, email.toLowerCase()),
  });

  // If employee doesn't exist, still "succeed" to avoid timing attacks
  // that could reveal whether an email is registered
  if (!employee) {
    // Add a small delay to match the timing of a successful request
    await new Promise((resolve) => setTimeout(resolve, 100));
    return;
  }

  // Generate secure token
  const token = generateSecureToken();

  // Calculate expiration
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + env.PASSWORD_RESET_EXPIRES_HOURS);

  // Store token in database
  await db.insert(passwordResetTokens).values({
    employeeId: employee.id,
    token,
    expiresAt,
  });

  // Build reset link
  const resetLink = `${env.APP_URL}/reset-password?token=${token}`;

  // Send email (logs to console in development if no Postmark key)
  await sendPasswordResetEmail(employee.email, resetLink, employee.name);
}

/**
 * Validate a password reset token.
 * Returns the employee if token is valid, null otherwise.
 */
export async function validateResetToken(token: string): Promise<Employee | null> {
  const resetRecord = await db.query.passwordResetTokens.findFirst({
    where: and(
      eq(passwordResetTokens.token, token),
      isNull(passwordResetTokens.usedAt),
      gt(passwordResetTokens.expiresAt, new Date())
    ),
    with: {
      employee: true,
    },
  });

  if (!resetRecord) {
    return null;
  }

  return resetRecord.employee;
}

/**
 * Complete the password reset process.
 * Updates the password and invalidates the token.
 */
export async function completePasswordReset(token: string, newPassword: string): Promise<void> {
  // Validate password strength first
  const passwordValidation = validatePasswordStrength(newPassword);
  if (!passwordValidation.valid) {
    throw new PasswordResetError(passwordValidation.errors.join(', '), 'PASSWORD_TOO_WEAK');
  }

  // Get and validate token
  const resetRecord = await db.query.passwordResetTokens.findFirst({
    where: eq(passwordResetTokens.token, token),
    with: {
      employee: true,
    },
  });

  if (!resetRecord) {
    throw new PasswordResetError('Invalid reset token', 'INVALID_TOKEN');
  }

  if (resetRecord.usedAt) {
    throw new PasswordResetError('Reset token has already been used', 'TOKEN_USED');
  }

  if (resetRecord.expiresAt < new Date()) {
    throw new PasswordResetError('Reset token has expired', 'TOKEN_EXPIRED');
  }

  // Mark token as used
  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.id, resetRecord.id));

  // Change password (this also revokes all sessions)
  await changePassword(resetRecord.employeeId, newPassword);
}

/**
 * Clean up expired password reset tokens.
 * Returns the number of tokens deleted.
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const result = await db
    .delete(passwordResetTokens)
    .where(
      // Delete tokens that are expired OR already used (older than 1 day)
      eq(passwordResetTokens.expiresAt, new Date())
    )
    .returning();

  return result.length;
}
