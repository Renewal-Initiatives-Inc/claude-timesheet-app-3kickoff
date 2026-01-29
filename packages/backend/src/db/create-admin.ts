/**
 * Create Initial Supervisor Account
 *
 * This script creates the first supervisor account for production.
 * The supervisor can then onboard other employees through the application.
 *
 * USAGE:
 *   npm run db:create-admin -w @renewal/backend -- \
 *     --name "Sarah Supervisor" \
 *     --email "sarah@renewal.org" \
 *     --password "TempPassword123!"
 *
 * Or with environment variables:
 *   ADMIN_NAME="Sarah Supervisor" \
 *   ADMIN_EMAIL="sarah@renewal.org" \
 *   ADMIN_PASSWORD="TempPassword123!" \
 *   npm run db:create-admin -w @renewal/backend
 *
 * IMPORTANT:
 * - The supervisor should change their password after first login
 * - The password must meet complexity requirements (8+ chars, letter + number)
 * - Use a date of birth for an adult (18+)
 */

import { db, schema } from './index.js';
import { eq } from 'drizzle-orm';
import { hashPassword, validatePasswordStrength } from '../utils/password.js';

const { employees } = schema;

// Parse command line arguments
function parseArgs(): { name: string; email: string; password: string; dateOfBirth: string } {
  const args = process.argv.slice(2);
  const parsed: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg?.startsWith('--') && i + 1 < args.length) {
      const key = arg.slice(2);
      const value = args[i + 1];
      if (value && !value.startsWith('--')) {
        parsed[key] = value;
        i++; // Skip the value
      }
    }
  }

  // Use environment variables as fallback
  const name = parsed['name'] || process.env['ADMIN_NAME'] || '';
  const email = parsed['email'] || process.env['ADMIN_EMAIL'] || '';
  const password = parsed['password'] || process.env['ADMIN_PASSWORD'] || '';
  const dateOfBirth = parsed['dob'] || process.env['ADMIN_DOB'] || '';

  return { name, email, password, dateOfBirth };
}

// Calculate date of birth for a given age (defaults to 30 years old)
function defaultDob(): string {
  const today = new Date();
  const year = today.getFullYear() - 30;
  return `${year}-01-15`;
}

async function createAdmin() {
  console.log('===========================================');
  console.log('CREATE SUPERVISOR ACCOUNT');
  console.log('===========================================');
  console.log('');

  const { name, email, password, dateOfBirth } = parseArgs();

  // Validate inputs
  if (!name || !email || !password) {
    console.log('Missing required arguments.');
    console.log('');
    console.log('Usage:');
    console.log('  npm run db:create-admin -w @renewal/backend -- \\');
    console.log('    --name "Full Name" \\');
    console.log('    --email "email@example.com" \\');
    console.log('    --password "SecurePassword123!"');
    console.log('');
    console.log('Optional:');
    console.log('    --dob "1990-01-15"  (Date of birth, YYYY-MM-DD format)');
    console.log('');
    console.log('Or use environment variables:');
    console.log('  ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_DOB');
    console.log('');
    process.exit(1);
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.error('ERROR: Invalid email format');
    process.exit(1);
  }

  // Validate password strength
  const passwordValidation = validatePasswordStrength(password);
  if (!passwordValidation.valid) {
    console.error('ERROR: Password does not meet requirements:');
    for (const error of passwordValidation.errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  // Use provided DOB or default
  const dob = dateOfBirth || defaultDob();

  // Validate DOB makes them an adult
  const birthDate = new Date(dob);
  const today = new Date();
  const age = Math.floor((today.getTime() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  if (age < 18) {
    console.error('ERROR: Supervisor must be 18 or older');
    process.exit(1);
  }

  console.log('Creating supervisor account:');
  console.log(`  Name: ${name}`);
  console.log(`  Email: ${email}`);
  console.log(`  Date of Birth: ${dob} (Age: ${age})`);
  console.log('');

  // Check if email already exists
  const existing = await db
    .select()
    .from(employees)
    .where(eq(employees.email, email.toLowerCase()))
    .limit(1);

  if (existing.length > 0) {
    console.error('ERROR: An account with this email already exists');
    console.error('');
    console.error('If you need to reset this account, use the application');
    console.error('password reset feature or update directly in the database.');
    process.exit(1);
  }

  // Hash password
  console.log('Hashing password...');
  const passwordHash = await hashPassword(password);

  // Create supervisor account
  console.log('Creating account...');
  const [supervisor] = await db
    .insert(employees)
    .values({
      name,
      email: email.toLowerCase(),
      dateOfBirth: dob,
      isSupervisor: true,
      status: 'active',
      passwordHash,
      failedLoginAttempts: 0,
    })
    .returning();

  console.log('');
  console.log('===========================================');
  console.log('SUPERVISOR ACCOUNT CREATED SUCCESSFULLY');
  console.log('===========================================');
  console.log('');
  console.log('Account details:');
  console.log(`  ID: ${supervisor?.id}`);
  console.log(`  Name: ${supervisor?.name}`);
  console.log(`  Email: ${supervisor?.email}`);
  console.log(`  Role: Supervisor`);
  console.log('');
  console.log('IMPORTANT SECURITY NOTES:');
  console.log('1. Have the supervisor change their password after first login');
  console.log('2. Do not share the temporary password via insecure channels');
  console.log('3. Delete this command from your shell history if it contains the password');
  console.log('');
  console.log('The supervisor can now:');
  console.log('- Log in to the application');
  console.log('- Create employee accounts');
  console.log('- Upload employee documents');
  console.log('- Review and approve timesheets');
  console.log('');

  process.exit(0);
}

createAdmin().catch((error) => {
  console.error('');
  console.error('FAILED TO CREATE ACCOUNT:', error.message);
  console.error('');
  if (error.code === '23505') {
    console.error('This email address is already in use.');
  }
  process.exit(1);
});
