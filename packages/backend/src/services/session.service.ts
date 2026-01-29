import { and, eq, isNull, lt, gt } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { signToken } from '../utils/jwt.js';
import { env } from '../config/env.js';

const { sessions, employees } = schema;

export type Session = typeof sessions.$inferSelect;

export interface CreateSessionResult {
  session: Session;
  token: string;
}

/**
 * Create a new session for an employee.
 * Returns the session record and JWT token.
 */
export async function createSession(employeeId: string): Promise<CreateSessionResult> {
  // Get employee info for token payload
  const employee = await db.query.employees.findFirst({
    where: eq(employees.id, employeeId),
  });

  if (!employee) {
    throw new Error('Employee not found');
  }

  // Generate JWT
  const token = signToken({
    employeeId: employee.id,
    email: employee.email,
    isSupervisor: employee.isSupervisor,
  });

  // Calculate expiration based on JWT_EXPIRES_IN
  const expiresAt = calculateExpiration(env.JWT_EXPIRES_IN);

  // Store session in database
  const [session] = await db
    .insert(sessions)
    .values({
      employeeId,
      token,
      expiresAt,
    })
    .returning();

  return { session: session!, token };
}

/**
 * Get an active (non-expired, non-revoked) session by token.
 */
export async function getActiveSession(token: string): Promise<Session | null> {
  const session = await db.query.sessions.findFirst({
    where: and(
      eq(sessions.token, token),
      isNull(sessions.revokedAt),
      gt(sessions.expiresAt, new Date())
    ),
  });

  return session ?? null;
}

/**
 * Revoke a session by token.
 */
export async function revokeSession(token: string): Promise<void> {
  await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.token, token));
}

/**
 * Revoke all sessions for an employee.
 * Used when password is changed or for security reasons.
 */
export async function revokeAllSessions(employeeId: string): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.employeeId, employeeId), isNull(sessions.revokedAt)));
}

/**
 * Clean up expired sessions from the database.
 * Returns the number of sessions deleted.
 * Can be called by a scheduled job.
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await db.delete(sessions).where(lt(sessions.expiresAt, new Date())).returning();

  return result.length;
}

/**
 * Parse JWT expiration string (e.g., "7d", "24h") and calculate expiration date.
 */
function calculateExpiration(expiresIn: string): Date {
  const now = new Date();
  const match = expiresIn.match(/^(\d+)([dhms])$/);

  if (!match) {
    // Default to 7 days if invalid format
    now.setDate(now.getDate() + 7);
    return now;
  }

  const value = parseInt(match[1]!, 10);
  const unit = match[2];

  switch (unit) {
    case 'd':
      now.setDate(now.getDate() + value);
      break;
    case 'h':
      now.setHours(now.getHours() + value);
      break;
    case 'm':
      now.setMinutes(now.getMinutes() + value);
      break;
    case 's':
      now.setSeconds(now.getSeconds() + value);
      break;
  }

  return now;
}
