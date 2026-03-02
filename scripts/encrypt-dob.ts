/**
 * Data migration script: encrypt existing plaintext date_of_birth values.
 *
 * Prerequisites:
 *   1. Migration 0008 applied (column type changed to text)
 *   2. DOB_ENCRYPTION_KEY env var set
 *
 * Run with: npx tsx scripts/encrypt-dob.ts
 */

import { db, schema } from '../packages/backend/src/db/index.js';
import { eq } from 'drizzle-orm';
import { encryptDob } from '../packages/backend/src/utils/encryption.js';

const { employees } = schema;

async function migrate() {
  console.log('Encrypting date_of_birth values...');

  const allEmployees = await db.select().from(employees);
  let encrypted = 0;
  let skipped = 0;

  for (const employee of allEmployees) {
    // Skip already-encrypted values (contain colons from iv:authTag:ciphertext format)
    if (employee.dateOfBirth.includes(':')) {
      skipped++;
      continue;
    }

    // Plaintext date: YYYY-MM-DD
    const encryptedDob = encryptDob(employee.dateOfBirth);
    await db
      .update(employees)
      .set({ dateOfBirth: encryptedDob })
      .where(eq(employees.id, employee.id));

    encrypted++;
    console.log(`  Encrypted DOB for ${employee.name} (${employee.id})`);
  }

  console.log(`\nDone: ${encrypted} encrypted, ${skipped} already encrypted`);
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
