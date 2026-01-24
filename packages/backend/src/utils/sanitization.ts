/**
 * Input sanitization utilities for XSS prevention.
 *
 * While React escapes output by default, we sanitize inputs on the server
 * as defense-in-depth. This ensures:
 * 1. Stored data doesn't contain malicious content
 * 2. Non-React consumers (CSV exports, emails) are protected
 * 3. Error messages that echo user input are safe
 */

/**
 * HTML entities that should be escaped.
 */
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

/**
 * Escape HTML special characters to prevent XSS.
 * Use this for any user input that will be displayed in HTML context.
 */
export function escapeHtml(str: string): string {
  if (!str || typeof str !== 'string') {
    return str;
  }
  return str.replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Strip HTML tags from a string.
 * Use this when you want plain text only (no HTML allowed).
 */
export function stripHtmlTags(str: string): string {
  if (!str || typeof str !== 'string') {
    return str;
  }
  return str.replace(/<[^>]*>/g, '');
}

/**
 * Sanitize a string for safe storage and display.
 * Strips HTML tags and normalizes whitespace.
 */
export function sanitizeString(str: string): string {
  if (!str || typeof str !== 'string') {
    return str;
  }

  return stripHtmlTags(str)
    .trim()
    .replace(/\s+/g, ' '); // Normalize whitespace
}

/**
 * Sanitize a string for use in error messages.
 * Escapes HTML and truncates to prevent log injection.
 */
export function sanitizeForErrorMessage(str: string, maxLength = 100): string {
  if (!str || typeof str !== 'string') {
    return String(str);
  }

  const sanitized = escapeHtml(str);
  if (sanitized.length > maxLength) {
    return sanitized.substring(0, maxLength) + '...';
  }
  return sanitized;
}

/**
 * Check if a string contains potentially dangerous content.
 * Returns true if the string appears to contain XSS attempts.
 */
export function containsSuspiciousContent(str: string): boolean {
  if (!str || typeof str !== 'string') {
    return false;
  }

  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i, // onclick=, onerror=, etc.
    /data:/i,
    /vbscript:/i,
    /<iframe/i,
    /<embed/i,
    /<object/i,
    /<svg.*onload/i,
    /expression\s*\(/i, // CSS expression
  ];

  return suspiciousPatterns.some((pattern) => pattern.test(str));
}

/**
 * Sanitize an object's string properties recursively.
 * Useful for sanitizing request bodies.
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const result = { ...obj };

  for (const [key, value] of Object.entries(result)) {
    if (typeof value === 'string') {
      (result as Record<string, unknown>)[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      (result as Record<string, unknown>)[key] = value.map((item) =>
        typeof item === 'string'
          ? sanitizeString(item)
          : typeof item === 'object' && item !== null
            ? sanitizeObject(item as Record<string, unknown>)
            : item
      );
    } else if (typeof value === 'object' && value !== null) {
      (result as Record<string, unknown>)[key] = sanitizeObject(
        value as Record<string, unknown>
      );
    }
  }

  return result;
}
