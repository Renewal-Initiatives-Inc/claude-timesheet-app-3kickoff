import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getKeyFromEnv(envVar: string): Buffer {
  const hex = process.env[envVar];
  if (!hex) {
    throw new Error(
      `${envVar} environment variable is required. Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
    );
  }
  const key = Buffer.from(hex, 'hex');
  if (key.length !== 32) {
    throw new Error(
      `${envVar} must be 32 bytes (64 hex chars), got ${key.length} bytes`
    );
  }
  return key;
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * Returns format: iv:authTag:ciphertext (all base64).
 */
export function encrypt(plaintext: string, keyEnvVar: string): string {
  const key = getKeyFromEnv(keyEnvVar);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypts a string previously encrypted with encrypt().
 */
export function decrypt(encrypted: string, keyEnvVar: string): string {
  const key = getKeyFromEnv(keyEnvVar);
  const parts = encrypted.split(':');

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted string format (expected iv:authTag:ciphertext)');
  }

  const ivB64 = parts[0]!;
  const authTagB64 = parts[1]!;
  const ciphertext = parts[2]!;
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// --- Date of birth helpers ---

const DOB_KEY = 'DOB_ENCRYPTION_KEY';

export function encryptDob(plaintext: string): string {
  return encrypt(plaintext, DOB_KEY);
}

/**
 * Decrypt a date of birth value.
 * Returns the plaintext YYYY-MM-DD string, or the input unchanged
 * if it looks like an unencrypted date (for legacy/migration compatibility).
 */
export function decryptDob(value: string): string {
  // Legacy plaintext dates are YYYY-MM-DD (10 chars, no colons in the base64 format)
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  return decrypt(value, DOB_KEY);
}
