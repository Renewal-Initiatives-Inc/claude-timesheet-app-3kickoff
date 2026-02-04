/**
 * Task Code Sync Script - Syncs task codes and rates to match Rate Card v2.0
 *
 * This script safely updates production task codes:
 * - Compares existing data with expected Rate Card values
 * - Reports all differences before making changes
 * - Updates existing records if they differ
 * - Adds missing task codes
 * - Creates new rate records for updated rates
 *
 * USAGE:
 *   # Dry run (shows what would change, no modifications):
 *   npm run db:sync-task-codes -w @renewal/backend
 *
 *   # Apply changes:
 *   npm run db:sync-task-codes -w @renewal/backend -- --apply
 *
 * Rate Card: Junior Farmer Apprenticeship Rate Card v2.0 (MA, Jan 2026)
 */

import { eq, desc } from 'drizzle-orm';
import { db, schema } from './index.js';

const { taskCodes, taskCodeRates } = schema;

type SupervisorRequired = 'none' | 'for_minors' | 'always';

interface TaskCodeDefinition {
  code: string;
  name: string;
  description: string;
  isAgricultural: boolean;
  isHazardous: boolean;
  supervisorRequired: SupervisorRequired;
  soloCashHandling: boolean;
  drivingRequired: boolean;
  powerMachinery: boolean;
  minAgeAllowed: number;
  isActive: boolean;
  rate: string;
}

// Task code definitions - aligned with official Rate Card v2.0 (Jan 2026)
const EXPECTED_TASK_CODES: TaskCodeDefinition[] = [
  // F1: Field Help (Agricultural)
  {
    code: 'F1',
    name: 'Field Help',
    description: 'Hand weeding, transplanting, light harvesting; no powered equipment',
    isAgricultural: true,
    isHazardous: false,
    supervisorRequired: 'for_minors',
    soloCashHandling: false,
    drivingRequired: false,
    powerMachinery: false,
    minAgeAllowed: 12,
    isActive: true,
    rate: '20.00',
  },
  // G1: Grounds / Paths (Non-Agricultural)
  {
    code: 'G1',
    name: 'Grounds / Paths',
    description: 'Raking, mulching, trail upkeep, hand-tool care; no powered mowers or trimmers',
    isAgricultural: false,
    isHazardous: false,
    supervisorRequired: 'for_minors',
    soloCashHandling: false,
    drivingRequired: false,
    powerMachinery: false,
    minAgeAllowed: 12,
    isActive: true,
    rate: '23.00',
  },
  // C1: Cleaning / Sanitation (Non-Agricultural)
  {
    code: 'C1',
    name: 'Cleaning / Sanitation',
    description: 'Sweeping, mopping, tidying common areas; no industrial chemicals',
    isAgricultural: false,
    isHazardous: false,
    supervisorRequired: 'for_minors',
    soloCashHandling: false,
    drivingRequired: false,
    powerMachinery: false,
    minAgeAllowed: 12,
    isActive: true,
    rate: '20.00',
  },
  // P1: Post-Harvest Wash / Pack (Non-Agricultural)
  {
    code: 'P1',
    name: 'Post-Harvest Wash / Pack',
    description: 'Washing, packing, labeling produce; packshed assistance',
    isAgricultural: false,
    isHazardous: false,
    supervisorRequired: 'for_minors',
    soloCashHandling: false,
    drivingRequired: false,
    powerMachinery: false,
    minAgeAllowed: 12,
    isActive: true,
    rate: '20.00',
  },
  // R1: CSA Assembly / Fulfillment (Non-Agricultural)
  {
    code: 'R1',
    name: 'CSA Assembly / Fulfillment',
    description: 'Weighing, labeling, assembling CSA boxes; staging orders',
    isAgricultural: false,
    isHazardous: false,
    supervisorRequired: 'for_minors',
    soloCashHandling: false,
    drivingRequired: false,
    powerMachinery: false,
    minAgeAllowed: 12,
    isActive: true,
    rate: '20.00',
  },
  // R2: Farmers' Market / Retail (Non-Agricultural) - Cash handling, min age 14
  {
    code: 'R2',
    name: "Farmers' Market / Retail",
    description: 'Booth setup, stocking, greeting, cashiering',
    isAgricultural: false,
    isHazardous: false,
    supervisorRequired: 'always',
    soloCashHandling: true,
    drivingRequired: false,
    powerMachinery: false,
    minAgeAllowed: 14,
    isActive: true,
    rate: '20.00',
  },
  // O1: Office / Data Entry (Non-Agricultural)
  {
    code: 'O1',
    name: 'Office / Data Entry',
    description: 'Logs, inventory sheets, basic spreadsheets',
    isAgricultural: false,
    isHazardous: false,
    supervisorRequired: 'for_minors',
    soloCashHandling: false,
    drivingRequired: false,
    powerMachinery: false,
    minAgeAllowed: 12,
    isActive: true,
    rate: '24.00',
  },
  // O2: Website / Online Promotion (Non-Agricultural) - min age 14
  {
    code: 'O2',
    name: 'Website / Online Promotion',
    description: 'CMS edits, product posts, photo captions; no coding',
    isAgricultural: false,
    isHazardous: false,
    supervisorRequired: 'for_minors',
    soloCashHandling: false,
    drivingRequired: false,
    powerMachinery: false,
    minAgeAllowed: 14,
    isActive: true,
    rate: '29.50',
  },
  // L1: Light Loading / Stock Movement (Non-Agricultural) - min age 14
  {
    code: 'L1',
    name: 'Light Loading / Stock Movement',
    description: 'Carrying/loading ≤50 lbs; team lifts; no forklifts/tractors',
    isAgricultural: false,
    isHazardous: false,
    supervisorRequired: 'for_minors',
    soloCashHandling: false,
    drivingRequired: false,
    powerMachinery: false,
    minAgeAllowed: 14,
    isActive: true,
    rate: '21.50',
  },
];

interface Difference {
  code: string;
  field: string;
  current: string | number | boolean | null;
  expected: string | number | boolean;
}

interface TaskCodeRecord {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isAgricultural: boolean;
  isHazardous: boolean;
  supervisorRequired: SupervisorRequired;
  soloCashHandling: boolean;
  drivingRequired: boolean;
  powerMachinery: boolean;
  minAgeAllowed: number;
  isActive: boolean;
}

interface RateRecord {
  id: string;
  taskCodeId: string;
  hourlyRate: string;
  effectiveDate: string;
}

async function syncTaskCodes() {
  console.log('===========================================');
  console.log('TASK CODE SYNC SCRIPT');
  console.log('Rate Card v2.0 (MA, Jan 2026)');
  console.log('===========================================');
  console.log('');

  const args = process.argv.slice(2);
  const applyChanges = args.includes('--apply');

  if (!applyChanges) {
    console.log('DRY RUN MODE - No changes will be made');
    console.log('Run with --apply to make changes');
    console.log('');
  } else {
    console.log('APPLY MODE - Changes will be written to database');
    console.log('');
  }

  // Fetch existing task codes
  console.log('Fetching existing task codes...');
  const existingTaskCodes = await db.select().from(taskCodes);
  console.log(`Found ${existingTaskCodes.length} existing task codes`);
  console.log('');

  // Create lookup by code
  const existingByCode = new Map<string, TaskCodeRecord>();
  for (const tc of existingTaskCodes) {
    existingByCode.set(tc.code, tc as TaskCodeRecord);
  }

  // Track changes
  const missingCodes: TaskCodeDefinition[] = [];
  const differences: Difference[] = [];
  const rateChanges: { code: string; currentRate: string | null; expectedRate: string }[] = [];

  // Compare each expected task code
  for (const expected of EXPECTED_TASK_CODES) {
    const existing = existingByCode.get(expected.code);

    if (!existing) {
      missingCodes.push(expected);
      continue;
    }

    // Compare fields
    const fieldsToCompare: (keyof Omit<TaskCodeDefinition, 'rate'>)[] = [
      'name',
      'description',
      'isAgricultural',
      'isHazardous',
      'supervisorRequired',
      'soloCashHandling',
      'drivingRequired',
      'powerMachinery',
      'minAgeAllowed',
      'isActive',
    ];

    for (const field of fieldsToCompare) {
      const currentValue = existing[field as keyof TaskCodeRecord];
      const expectedValue = expected[field];
      if (currentValue !== expectedValue) {
        differences.push({
          code: expected.code,
          field,
          current: currentValue,
          expected: expectedValue,
        });
      }
    }

    // Check rate
    const currentRates = await db
      .select()
      .from(taskCodeRates)
      .where(eq(taskCodeRates.taskCodeId, existing.id))
      .orderBy(desc(taskCodeRates.effectiveDate))
      .limit(1);

    const currentRate = currentRates.length > 0 ? (currentRates[0] as RateRecord).hourlyRate : null;

    if (currentRate !== expected.rate) {
      rateChanges.push({
        code: expected.code,
        currentRate,
        expectedRate: expected.rate,
      });
    }
  }

  // Check for unexpected codes in database
  const expectedCodes = new Set(EXPECTED_TASK_CODES.map((t) => t.code));
  const unexpectedCodes = existingTaskCodes.filter((tc) => !expectedCodes.has(tc.code));

  // Report findings
  console.log('===========================================');
  console.log('ANALYSIS RESULTS');
  console.log('===========================================');
  console.log('');

  if (missingCodes.length === 0 && differences.length === 0 && rateChanges.length === 0) {
    console.log('✅ All task codes match expected values!');
    console.log('   No changes needed.');
    console.log('');
    process.exit(0);
  }

  // Missing codes
  if (missingCodes.length > 0) {
    console.log(`❌ MISSING TASK CODES (${missingCodes.length}):`);
    for (const tc of missingCodes) {
      console.log(`   ${tc.code}: ${tc.name} @ $${tc.rate}/hr`);
    }
    console.log('');
  }

  // Field differences
  if (differences.length > 0) {
    console.log(`⚠️  FIELD DIFFERENCES (${differences.length}):`);
    for (const diff of differences) {
      console.log(`   ${diff.code}.${diff.field}:`);
      console.log(`      Current:  ${JSON.stringify(diff.current)}`);
      console.log(`      Expected: ${JSON.stringify(diff.expected)}`);
    }
    console.log('');
  }

  // Rate changes
  if (rateChanges.length > 0) {
    console.log(`💰 RATE CHANGES (${rateChanges.length}):`);
    for (const rc of rateChanges) {
      console.log(`   ${rc.code}: $${rc.currentRate ?? 'N/A'} → $${rc.expectedRate}`);
    }
    console.log('');
  }

  // Unexpected codes (warning only)
  if (unexpectedCodes.length > 0) {
    console.log(`ℹ️  EXTRA CODES IN DATABASE (not in Rate Card):`);
    for (const tc of unexpectedCodes) {
      console.log(`   ${tc.code}: ${tc.name}`);
    }
    console.log('   (These will NOT be modified)');
    console.log('');
  }

  if (!applyChanges) {
    console.log('===========================================');
    console.log('DRY RUN COMPLETE');
    console.log('===========================================');
    console.log('');
    console.log('To apply these changes, run:');
    console.log('  npm run db:sync-task-codes -w @renewal/backend -- --apply');
    console.log('');
    process.exit(0);
  }

  // Apply changes
  console.log('===========================================');
  console.log('APPLYING CHANGES');
  console.log('===========================================');
  console.log('');

  // Insert missing codes
  if (missingCodes.length > 0) {
    console.log('Inserting missing task codes...');
    for (const tc of missingCodes) {
      const { rate, ...taskCodeData } = tc;
      const [inserted] = await db.insert(taskCodes).values(taskCodeData).returning();
      if (!inserted) {
        throw new Error(`Failed to insert task code: ${tc.code}`);
      }
      console.log(`   Created: ${inserted.code}`);

      // Create rate record
      await db.insert(taskCodeRates).values({
        taskCodeId: inserted.id,
        hourlyRate: rate,
        effectiveDate: '2020-01-01',
        justificationNotes: 'Rate Card v2.0 (Jan 2026) - Initial sync',
      });
      console.log(`   Rate set: $${rate}/hr`);
    }
    console.log('');
  }

  // Update differing fields
  if (differences.length > 0) {
    console.log('Updating task code fields...');

    // Group differences by code
    const diffsByCode = new Map<string, Difference[]>();
    for (const diff of differences) {
      const existing = diffsByCode.get(diff.code) || [];
      existing.push(diff);
      diffsByCode.set(diff.code, existing);
    }

    for (const [code, diffs] of diffsByCode) {
      const existing = existingByCode.get(code)!;
      const updates: Record<string, string | number | boolean> = {};

      for (const diff of diffs) {
        updates[diff.field] = diff.expected;
      }

      await db.update(taskCodes).set(updates).where(eq(taskCodes.id, existing.id));

      console.log(`   Updated ${code}: ${diffs.map((d) => d.field).join(', ')}`);
    }
    console.log('');
  }

  // Create new rate records for rate changes
  if (rateChanges.length > 0) {
    console.log('Creating new rate records...');
    const effectiveDate = new Date().toISOString().split('T')[0]!; // Today's date (YYYY-MM-DD)

    for (const rc of rateChanges) {
      const existing = existingByCode.get(rc.code);
      const taskCodeId = existing?.id;
      if (!taskCodeId) {
        throw new Error(`Task code not found: ${rc.code}`);
      }

      await db.insert(taskCodeRates).values({
        taskCodeId,
        hourlyRate: rc.expectedRate,
        effectiveDate,
        justificationNotes: 'Rate Card v2.0 (Jan 2026) - Sync update',
      });

      console.log(`   ${rc.code}: New rate $${rc.expectedRate}/hr effective ${effectiveDate}`);
    }
    console.log('');
  }

  console.log('===========================================');
  console.log('SYNC COMPLETED SUCCESSFULLY');
  console.log('===========================================');
  console.log('');
  console.log('Summary:');
  console.log(`   Task codes created: ${missingCodes.length}`);
  console.log(`   Task codes updated: ${new Set(differences.map((d) => d.code)).size}`);
  console.log(`   New rate records:   ${rateChanges.length}`);
  console.log('');

  process.exit(0);
}

syncTaskCodes().catch((error) => {
  console.error('');
  console.error('SYNC FAILED:', error);
  console.error('');
  process.exit(1);
});
