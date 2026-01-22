import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  // DATABASE_URL is optional at startup to allow health checks without DB
  // The db module will throw if DATABASE_URL is missing when actually accessing the database
  DATABASE_URL: z
    .string()
    .url('DATABASE_URL must be a valid PostgreSQL URL')
    .optional(),
  FRONTEND_URL: z.string().default('http://localhost:5173'),

  // Authentication
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // Email (Postmark)
  POSTMARK_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().default('noreply@renewal.org'),

  // Password reset
  PASSWORD_RESET_EXPIRES_HOURS: z.coerce.number().default(24),

  // Account lockout
  MAX_LOGIN_ATTEMPTS: z.coerce.number().default(5),
  LOCKOUT_DURATION_MINUTES: z.coerce.number().default(30),

  // App URL for password reset links
  APP_URL: z.string().url().default('http://localhost:5173'),

  // Vercel Blob storage
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
});

function loadEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Invalid environment variables:');
    console.error(result.error.format());
    process.exit(1);
  }

  return result.data;
}

export const env = loadEnv();
