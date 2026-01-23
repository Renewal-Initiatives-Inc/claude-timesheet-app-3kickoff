import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { env } from '../config/env.js';

export interface TokenPayload {
  employeeId: string;
  email: string;
  isSupervisor: boolean;
  jti?: string;  // JWT ID for uniqueness
  iat?: number;
  exp?: number;
}

/**
 * Parse the JWT_EXPIRES_IN string to seconds.
 * Supports formats like "7d", "24h", "60m", "3600s", or raw seconds as string.
 */
function parseExpiresIn(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)([dhms])?$/);
  if (!match) {
    return 7 * 24 * 60 * 60; // Default 7 days in seconds
  }

  const value = parseInt(match[1]!, 10);
  const unit = match[2] || 's';

  switch (unit) {
    case 'd':
      return value * 24 * 60 * 60;
    case 'h':
      return value * 60 * 60;
    case 'm':
      return value * 60;
    case 's':
    default:
      return value;
  }
}

/**
 * Sign a JWT with employee information.
 * Token expires after the configured duration (default: 7 days).
 * Each token includes a unique jti (JWT ID) to prevent duplicates.
 */
export function signToken(payload: Omit<TokenPayload, 'jti' | 'iat' | 'exp'>): string {
  const expiresInSeconds = parseExpiresIn(env.JWT_EXPIRES_IN);
  return jwt.sign(
    { ...payload, jti: randomUUID() },
    env.JWT_SECRET,
    { expiresIn: expiresInSeconds }
  );
}

/**
 * Verify and decode a JWT.
 * Returns the payload if valid, null if invalid or expired.
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
    return decoded;
  } catch {
    return null;
  }
}
