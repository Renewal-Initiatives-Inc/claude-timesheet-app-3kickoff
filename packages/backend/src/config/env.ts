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
