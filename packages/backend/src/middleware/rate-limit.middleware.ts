import rateLimit from 'express-rate-limit';
import { Request } from 'express';

/**
 * Rate limiting middleware for security hardening.
 * Protects against brute-force attacks on auth endpoints.
 */

const rateLimitMessage = (message: string) => ({
  error: 'RATE_LIMITED',
  message,
});

/**
 * Check if we should skip rate limiting (test environment).
 */
const shouldSkip = () => process.env['NODE_ENV'] === 'test';

/**
 * Strict rate limit for login attempts.
 * 5 requests per 15 minutes per IP.
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true, // Return rate limit info in RateLimit-* headers
  legacyHeaders: true, // Also send X-RateLimit-* headers for compatibility
  message: rateLimitMessage('Too many login attempts. Please try again in 15 minutes.'),
  skip: shouldSkip,
  // Use default keyGenerator which properly handles IPv6
});

/**
 * Rate limit for password reset requests.
 * 3 requests per hour per IP.
 */
export const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  standardHeaders: true,
  legacyHeaders: true,
  message: rateLimitMessage('Too many password reset requests. Please try again in an hour.'),
  skip: shouldSkip,
});

/**
 * Rate limit for registration.
 * 10 requests per hour per IP.
 */
export const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: true,
  message: rateLimitMessage('Too many registration attempts. Please try again later.'),
  skip: shouldSkip,
});

/**
 * General API rate limit.
 * 100 requests per minute per IP.
 */
export const generalRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: true,
  message: rateLimitMessage('Too many requests. Please slow down.'),
  skip: shouldSkip,
});
