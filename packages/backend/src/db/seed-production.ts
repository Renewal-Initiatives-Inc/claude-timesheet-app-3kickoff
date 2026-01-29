/**
 * Production seed script - creates task codes and rates ONLY.
 *
 * This script is designed for fresh production databases. It will:
 * - Create all task codes with compliance attributes
 * - Create initial rates for each task code
 *
 * It will NOT create:
 * - Test employees or passwords
 * - Test documents
 * - Any test data
 *
 * USAGE:
 *   npm run db:seed:production -w @renewal/backend
 *
 * IMPORTANT:
 * - Run this ONLY ONCE on a fresh production database
 * - Verify task codes and rates with the organization before running
 * - Use create-admin.ts separately to create the initial supervisor
 *
 * Rate Card: Junior Farmer Apprenticeship Rate Card v2.0 (MA, Jan 2026)
 * Rates aligned with BLS OEWS MA market data.
 *
 * Wage Floors (for reference only - actual rates are higher):
 * - Agricultural tasks: $8.00/hr (MA agricultural minimum)
 * - Non-agricultural tasks: $15.00/hr (MA general minimum)
 */

import { db, schema } from './index.js';

const { taskCodes, taskCodeRates } = schema;

// Task code definitions - aligned with official Rate Card v2.0 (Jan 2026)
const TASK_CODE_DATA = [
  // F1: Field Help (Agricultural)
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
    isActive: true,
    rate: '20.00', // BLS agricultural worker reference
  },
  // G1: Grounds / Paths (Non-Agricultural)
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
    isActive: true,
    rate: '23.00', // BLS Landscaping median $22.41
  },
  // C1: Cleaning / Sanitation (Non-Agricultural)
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
    isActive: true,
    rate: '20.00', // BLS Janitors mean $20.23
  },
  // P1: Post-Harvest Wash / Pack (Non-Agricultural)
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
    isActive: true,
    rate: '20.00', // Non-ag per MA case law (Arias-Villano)
  },
  // R1: CSA Assembly / Fulfillment (Non-Agricultural)
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
    isActive: true,
    rate: '20.00', // BLS Stockers mean $19.24
  },
  // R2: Farmers' Market / Retail (Non-Agricultural) - Cash handling, min age 14
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
    isActive: true,
    rate: '20.00', // BLS Retail mean $19.47
  },
  // O1: Office / Data Entry (Non-Agricultural)
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
    isActive: true,
    rate: '24.00', // BLS Office Clerks mean $24.75
  },
  // O2: Website / Online Promotion (Non-Agricultural) - min age 14
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
    isActive: true,
    rate: '29.50', // Higher skill + judgment
  },
  // L1: Light Loading / Stock Movement (Non-Agricultural) - min age 14
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
    isActive: true,
    rate: '21.50', // BLS Laborers mean $21.46
  },
];

async function seedProduction() {
  console.log('===========================================');
  console.log('PRODUCTION SEED SCRIPT');
  console.log('===========================================');
  console.log('');

  // Safety check: Verify this is intentional
  const args = process.argv.slice(2);
  if (!args.includes('--confirm')) {
    console.log('This script seeds task codes to the database.');
    console.log('');
    console.log('Before running, ensure you have:');
    console.log('1. Verified DATABASE_URL points to the correct database');
    console.log('2. Confirmed task codes and rates with the organization');
    console.log('3. Run database migrations');
    console.log('');
    console.log('To proceed, run with --confirm flag:');
    console.log('  npm run db:seed:production -- --confirm');
    console.log('');
    process.exit(0);
  }

  console.log('Checking if database already has task codes...');

  // Check if task codes already exist
  const existingTaskCodes = await db.select().from(taskCodes).limit(1);

  if (existingTaskCodes.length > 0) {
    console.log('');
    console.log('WARNING: Database already contains task codes.');
    console.log('This script should only be run on a fresh database.');
    console.log('');
    console.log('If you need to update task codes, use the application UI');
    console.log('or create a migration script.');
    console.log('');
    process.exit(1);
  }

  console.log('Database is empty. Proceeding with seed...');
  console.log('');

  // Create task codes
  console.log('Creating task codes...');

  const taskCodeInserts = TASK_CODE_DATA.map(({ rate: _rate, ...taskCode }) => taskCode);

  const insertedTaskCodes = await db.insert(taskCodes).values(taskCodeInserts).returning();

  console.log(`Created ${insertedTaskCodes.length} task codes`);

  // Create initial rates for each task code
  console.log('Creating task code rates...');

  const today = new Date().toISOString().split('T')[0]!;
  const rates = insertedTaskCodes.map((tc) => {
    const taskCodeData = TASK_CODE_DATA.find((t) => t.code === tc.code);
    return {
      taskCodeId: tc.id,
      hourlyRate: taskCodeData?.rate || (tc.isAgricultural ? '8.00' : '15.00'),
      effectiveDate: today,
      justificationNotes: 'Rate Card v2.0 (Jan 2026) - aligned with BLS OEWS MA market data',
    };
  });

  const insertedRates = await db.insert(taskCodeRates).values(rates).returning();
  console.log(`Created ${insertedRates.length} task code rates`);

  console.log('');
  console.log('===========================================');
  console.log('PRODUCTION SEED COMPLETED SUCCESSFULLY');
  console.log('===========================================');
  console.log('');
  console.log('Summary:');
  console.log(`- ${insertedTaskCodes.length} task codes created`);
  console.log(`- ${insertedRates.length} task code rates created`);
  console.log('');
  console.log('Task codes created:');
  for (const tc of insertedTaskCodes) {
    const rate = TASK_CODE_DATA.find((t) => t.code === tc.code)?.rate;
    console.log(
      `  ${tc.code}: ${tc.name} - $${rate}/hr (${tc.isAgricultural ? 'Agricultural' : 'Non-Agricultural'})`
    );
  }
  console.log('');
  console.log('Next steps:');
  console.log('1. Create initial supervisor account using create-admin.ts');
  console.log('2. Verify task codes in application');
  console.log('3. Begin soft launch with limited users');
  console.log('');

  process.exit(0);
}

seedProduction().catch((error) => {
  console.error('');
  console.error('SEED FAILED:', error);
  console.error('');
  process.exit(1);
});
