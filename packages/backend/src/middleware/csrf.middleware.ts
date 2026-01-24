import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';

/**
 * CSRF protection using double-submit cookie pattern.
 *
 * How it works:
 * 1. Server generates a random token and sets it in a cookie
 * 2. Client must read the cookie and send the token in X-CSRF-Token header
 * 3. Server verifies the header matches the cookie
 *
 * This works because:
 * - Attackers can't read cookies from another domain (same-origin policy)
 * - They can't know what value to put in the header
 * - Even with CORS credentials, they can't read the response/cookies cross-origin
 */

const CSRF_COOKIE_NAME = '_csrf';
const CSRF_HEADER_NAME = 'x-csrf-token';
const TOKEN_LENGTH = 32;

/**
 * Generate a cryptographically secure random token.
 */
function generateCsrfToken(): string {
  return randomBytes(TOKEN_LENGTH).toString('hex');
}

/**
 * Set CSRF token cookie.
 */
export function setCsrfToken(res: Response): string {
  const token = generateCsrfToken();

  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Must be readable by JavaScript
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/',
  });

  return token;
}

/**
 * Middleware to validate CSRF token on state-changing requests.
 *
 * Only validates on POST, PUT, PATCH, DELETE requests.
 * GET, HEAD, OPTIONS are safe methods and don't require CSRF protection.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Skip in test environment
  if (process.env['NODE_ENV'] === 'test') {
    return next();
  }

  // Safe methods don't need CSRF validation
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.header(CSRF_HEADER_NAME);

  // If no CSRF cookie exists, generate one
  // This handles the first request after the cookie expires
  if (!cookieToken) {
    setCsrfToken(res);
    res.status(403).json({
      error: 'CSRF_TOKEN_MISSING',
      message: 'CSRF token not found. Please refresh the page and try again.',
    });
    return;
  }

  // Validate token
  if (!headerToken || headerToken !== cookieToken) {
    res.status(403).json({
      error: 'CSRF_TOKEN_INVALID',
      message: 'Invalid CSRF token. Please refresh the page and try again.',
    });
    return;
  }

  next();
}

/**
 * Middleware to generate CSRF token on initial page load or login.
 * Use this on successful authentication.
 */
export function csrfTokenGenerator(req: Request, res: Response, next: NextFunction): void {
  // Skip in test environment
  if (process.env['NODE_ENV'] === 'test') {
    return next();
  }

  // Only generate if no token exists
  if (!req.cookies?.[CSRF_COOKIE_NAME]) {
    setCsrfToken(res);
  }

  next();
}

/**
 * Endpoint handler to get/refresh CSRF token.
 * The frontend can call this to get a fresh token.
 */
export function csrfTokenEndpoint(req: Request, res: Response): void {
  const token = setCsrfToken(res);

  res.json({
    csrfToken: token,
  });
}
