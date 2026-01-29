/**
 * Update task codes script - updates existing task codes to match Rate Card v2.0.
 * Safe for production - preserves timesheet entries by updating rather than deleting.
 *
 * This script will:
 * 1. Update existing task codes to match the new rate card
 * 2. Add any new task codes that don't exist
 * 3. Mark obsolete task codes as inactive (preserves historical data)
 * 4. Add new rates with today's effective date
 */

import { db, schema } from './index.js';
import { eq } from 'drizzle-orm';

const { taskCodes, taskCodeRates } = schema;

// Rate Card v2.0 (Jan 2026) - aligned with BLS OEWS MA market data
const RATE_CARD_V2 = [
  {
    code: 'F1',
    name: 'Field Help',
    description: 'Hand weeding, transplanting, light harvesting; no powered equipment',
    isAgricultural: true,
    isHazardous: false,
    supervisorRequired: 'for_minors' as const,
    soloCashHandling: false,
    drivingRequired: false,
    powerMachinery: false,
    minAgeAllowed: 12,
    rate: '20.00',
  },
  {
    code: 'G1',
    name: 'Grounds / Paths',
    description: 'Raking, mulching, trail upkeep, hand-tool care; no powered mowers or trimmers',
    isAgricultural: false,
    isHazardous: false,
    supervisorRequired: 'for_minors' as const,
    soloCashHandling: false,
    drivingRequired: false,
    powerMachinery: false,
    minAgeAllowed: 12,
    rate: '23.00',
  },
  {
    code: 'C1',
    name: 'Cleaning / Sanitation',
    description: 'Sweeping, mopping, tidying common areas; no industrial chemicals',
    isAgricultural: false,
    isHazardous: false,
    supervisorRequired: 'for_minors' as const,
    soloCashHandling: false,
    drivingRequired: false,
    powerMachinery: false,
    minAgeAllowed: 12,
    rate: '20.00',
  },
  {
    code: 'P1',
    name: 'Post-Harvest Wash / Pack',
    description: 'Washing, packing, labeling produce; packshed assistance',
    isAgricultural: false,
    isHazardous: false,
    supervisorRequired: 'for_minors' as const,
    soloCashHandling: false,
    drivingRequired: false,
    powerMachinery: false,
    minAgeAllowed: 12,
    rate: '20.00',
  },
  {
    code: 'R1',
    name: 'CSA Assembly / Fulfillment',
    description: 'Weighing, labeling, assembling CSA boxes; staging orders',
    isAgricultural: false,
    isHazardous: false,
    supervisorRequired: 'for_minors' as const,
    soloCashHandling: false,
    drivingRequired: false,
    powerMachinery: false,
    minAgeAllowed: 12,
    rate: '20.00',
  },
  {
    code: 'R2',
    name: "Farmers' Market / Retail",
    description: 'Booth setup, stocking, greeting, cashiering',
    isAgricultural: false,
    isHazardous: false,
    supervisorRequired: 'always' as const,
    soloCashHandling: true,
    drivingRequired: false,
    powerMachinery: false,
    minAgeAllowed: 14,
    rate: '20.00',
  },
  {
    code: 'O1',
    name: 'Office / Data Entry',
    description: 'Logs, inventory sheets, basic spreadsheets',
    isAgricultural: false,
    isHazardous: false,
    supervisorRequired: 'for_minors' as const,
    soloCashHandling: false,
    drivingRequired: false,
    powerMachinery: false,
    minAgeAllowed: 12,
    rate: '24.00',
  },
  {
    code: 'O2',
    name: 'Website / Online Promotion',
    description: 'CMS edits, product posts, photo captions; no coding',
    isAgricultural: false,
    isHazardous: false,
    supervisorRequired: 'for_minors' as const,
    soloCashHandling: false,
    drivingRequired: false,
    powerMachinery: false,
    minAgeAllowed: 14,
    rate: '29.50',
  },
  {
    code: 'L1',
    name: 'Light Loading / Stock Movement',
    description: 'Carrying/loading ≤50 lbs; team lifts; no forklifts/tractors',
    isAgricultural: false,
    isHazardous: false,
    supervisorRequired: 'for_minors' as const,
    soloCashHandling: false,
    drivingRequired: false,
    powerMachinery: false,
    minAgeAllowed: 14,
    rate: '21.50',
  },
];

// Old task codes to mark as inactive (will be kept for historical reference)
const OBSOLETE_CODES = ['F2', 'F3', 'F4', 'F5', 'F6', 'R3', 'A1', 'A2', 'M1', 'M2', 'D1'];

async function updateTaskCodes() {
  console.log('===========================================');
  console.log('UPDATE TASK CODES TO RATE CARD v2.0');
  console.log('===========================================');
  console.log('');

  const args = process.argv.slice(2);
  if (!args.includes('--confirm')) {
    console.log('This will update task codes and rates to match Rate Card v2.0.');
    console.log('');
    console.log('Changes:');
    console.log('- Update existing codes: F1, R1, R2');
    console.log('- Add new codes: G1, C1, P1, O1, O2, L1');
    console.log('- Mark obsolete: F2-F6, R3, A1, A2, M1, M2, D1');
    console.log('');
    console.log('Run with --confirm to proceed.');
    process.exit(0);
  }

  const today = new Date().toISOString().split('T')[0]!;
  let updated = 0;
  let created = 0;
  let deactivated = 0;
  let ratesAdded = 0;

  // Get all existing task codes
  const existingCodes = await db.select().from(taskCodes);
  const existingByCode = new Map(existingCodes.map((tc) => [tc.code, tc]));

  // Process each task code from the rate card
  for (const rateCardEntry of RATE_CARD_V2) {
    const { rate, ...taskCodeData } = rateCardEntry;
    const existing = existingByCode.get(rateCardEntry.code);

    if (existing) {
      // Update existing task code
      console.log(`Updating ${rateCardEntry.code}: ${rateCardEntry.name}`);
      await db
        .update(taskCodes)
        .set({
          ...taskCodeData,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(taskCodes.id, existing.id));
      updated++;

      // Add new rate if different from current
      const currentRates = await db
        .select()
        .from(taskCodeRates)
        .where(eq(taskCodeRates.taskCodeId, existing.id));

      const latestRate = currentRates.sort(
        (a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime()
      )[0];

      if (!latestRate || latestRate.hourlyRate !== rate) {
        console.log(`  Adding new rate: $${rate}/hr (was $${latestRate?.hourlyRate || 'N/A'}/hr)`);
        await db.insert(taskCodeRates).values({
          taskCodeId: existing.id,
          hourlyRate: rate,
          effectiveDate: today,
          justificationNotes: 'Rate Card v2.0 (Jan 2026) - aligned with BLS OEWS MA market data',
        });
        ratesAdded++;
      } else {
        console.log(`  Rate unchanged: $${rate}/hr`);
      }
    } else {
      // Create new task code
      console.log(`Creating ${rateCardEntry.code}: ${rateCardEntry.name}`);
      const [newTaskCode] = await db
        .insert(taskCodes)
        .values({
          ...taskCodeData,
          isActive: true,
        })
        .returning();
      created++;

      // Add initial rate
      console.log(`  Adding rate: $${rate}/hr`);
      await db.insert(taskCodeRates).values({
        taskCodeId: newTaskCode.id,
        hourlyRate: rate,
        effectiveDate: today,
        justificationNotes: 'Rate Card v2.0 (Jan 2026) - aligned with BLS OEWS MA market data',
      });
      ratesAdded++;
    }
  }

  // Mark obsolete task codes as inactive
  console.log('');
  console.log('Marking obsolete task codes as inactive...');
  for (const code of OBSOLETE_CODES) {
    const existing = existingByCode.get(code);
    if (existing && existing.isActive) {
      console.log(`  Deactivating ${code}: ${existing.name}`);
      await db
        .update(taskCodes)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(taskCodes.id, existing.id));
      deactivated++;
    }
  }

  console.log('');
  console.log('===========================================');
  console.log('UPDATE COMPLETED SUCCESSFULLY');
  console.log('===========================================');
  console.log('');
  console.log('Summary:');
  console.log(`- Task codes updated: ${updated}`);
  console.log(`- Task codes created: ${created}`);
  console.log(`- Task codes deactivated: ${deactivated}`);
  console.log(`- New rates added: ${ratesAdded}`);
  console.log('');

  process.exit(0);
}

updateTaskCodes().catch((error) => {
  console.error('');
  console.error('UPDATE FAILED:', error);
  console.error('');
  process.exit(1);
});
