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
 * Rate verification before seeding:
 * - Agricultural tasks: $8.00/hr (MA agricultural minimum)
 * - Non-agricultural tasks: $15.00/hr (MA general minimum)
 */

import { db, schema } from './index.js';
import { eq } from 'drizzle-orm';

const { taskCodes, taskCodeRates } = schema;

// Task code definitions - VERIFY WITH ORGANIZATION BEFORE DEPLOYING
const TASK_CODE_DATA = [
  // Field work (agricultural)
  {
    code: 'F1',
    name: 'Field Harvesting - Light',
    description: 'Light crop harvesting, berry picking',
    isAgricultural: true,
    isHazardous: false,
    supervisorRequired: 'for_minors' as const,
    soloCashHandling: false,
    drivingRequired: false,
    powerMachinery: false,
    minAgeAllowed: 12,
    isActive: true,
    rate: '8.00', // Agricultural rate
  },
  {
    code: 'F2',
    name: 'Field Planting',
    description: 'Seedling planting and transplanting',
    isAgricultural: true,
    isHazardous: false,
    supervisorRequired: 'for_minors' as const,
    soloCashHandling: false,
    drivingRequired: false,
    powerMachinery: false,
    minAgeAllowed: 12,
    isActive: true,
    rate: '8.00',
  },
  {
    code: 'F3',
    name: 'Irrigation Assistance',
    description: 'Helping with irrigation systems',
    isAgricultural: true,
    isHazardous: false,
    supervisorRequired: 'for_minors' as const,
    soloCashHandling: false,
    drivingRequired: false,
    powerMachinery: false,
    minAgeAllowed: 14,
    isActive: true,
    rate: '8.00',
  },
  {
    code: 'F4',
    name: 'Equipment Operation - Light',
    description: 'Small equipment operation (non-hazardous)',
    isAgricultural: true,
    isHazardous: false,
    supervisorRequired: 'always' as const,
    soloCashHandling: false,
    drivingRequired: false,
    powerMachinery: true,
    minAgeAllowed: 16,
    isActive: true,
    rate: '8.00',
  },
  {
    code: 'F5',
    name: 'Heavy Equipment Operation',
    description: 'Tractor and heavy machinery',
    isAgricultural: true,
    isHazardous: true,
    supervisorRequired: 'always' as const,
    soloCashHandling: false,
    drivingRequired: true,
    powerMachinery: true,
    minAgeAllowed: 18,
    isActive: true,
    rate: '8.00',
  },
  {
    code: 'F6',
    name: 'Pesticide Application',
    description: 'Applying agricultural chemicals',
    isAgricultural: true,
    isHazardous: true,
    supervisorRequired: 'always' as const,
    soloCashHandling: false,
    drivingRequired: false,
    powerMachinery: false,
    minAgeAllowed: 18,
    isActive: true,
    rate: '8.00',
  },
  // Retail (non-agricultural)
  {
    code: 'R1',
    name: 'Farm Stand - Customer Service',
    description: 'Greeting customers, answering questions',
    isAgricultural: false,
    isHazardous: false,
    supervisorRequired: 'none' as const,
    soloCashHandling: false,
    drivingRequired: false,
    powerMachinery: false,
    minAgeAllowed: 12,
    isActive: true,
    rate: '15.00', // Non-agricultural rate
  },
  {
    code: 'R2',
    name: 'Farm Stand - Cash Register',
    description: 'Operating register, handling payments',
    isAgricultural: false,
    isHazardous: false,
    supervisorRequired: 'for_minors' as const,
    soloCashHandling: true,
    drivingRequired: false,
    powerMachinery: false,
    minAgeAllowed: 16,
    isActive: true,
    rate: '15.00',
  },
  {
    code: 'R3',
    name: 'Inventory Stocking',
    description: 'Stocking shelves and displays',
    isAgricultural: false,
    isHazardous: false,
    supervisorRequired: 'none' as const,
    soloCashHandling: false,
    drivingRequired: false,
    powerMachinery: false,
    minAgeAllowed: 12,
    isActive: true,
    rate: '15.00',
  },
  // Administrative
  {
    code: 'A1',
    name: 'Office Filing',
    description: 'Document organization and filing',
    isAgricultural: false,
    isHazardous: false,
    supervisorRequired: 'none' as const,
    soloCashHandling: false,
    drivingRequired: false,
    powerMachinery: false,
    minAgeAllowed: 14,
    isActive: true,
    rate: '15.00',
  },
  {
    code: 'A2',
    name: 'Data Entry',
    description: 'Computer data entry tasks',
    isAgricultural: false,
    isHazardous: false,
    supervisorRequired: 'none' as const,
    soloCashHandling: false,
    drivingRequired: false,
    powerMachinery: false,
    minAgeAllowed: 14,
    isActive: true,
    rate: '15.00',
  },
  // Maintenance
  {
    code: 'M1',
    name: 'Grounds Keeping - Light',
    description: 'Sweeping, raking, light cleanup',
    isAgricultural: false,
    isHazardous: false,
    supervisorRequired: 'none' as const,
    soloCashHandling: false,
    drivingRequired: false,
    powerMachinery: false,
    minAgeAllowed: 12,
    isActive: true,
    rate: '15.00',
  },
  {
    code: 'M2',
    name: 'Grounds Keeping - Power Tools',
    description: 'Using lawn mowers, leaf blowers',
    isAgricultural: false,
    isHazardous: false,
    supervisorRequired: 'for_minors' as const,
    soloCashHandling: false,
    drivingRequired: false,
    powerMachinery: true,
    minAgeAllowed: 16,
    isActive: true,
    rate: '15.00',
  },
  // Delivery
  {
    code: 'D1',
    name: 'Delivery Driver',
    description: 'Driving delivery vehicle',
    isAgricultural: false,
    isHazardous: false,
    supervisorRequired: 'none' as const,
    soloCashHandling: false,
    drivingRequired: true,
    powerMachinery: false,
    minAgeAllowed: 18,
    isActive: true,
    rate: '15.00',
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

  const taskCodeInserts = TASK_CODE_DATA.map(
    ({ rate: _rate, ...taskCode }) => taskCode
  );

  const insertedTaskCodes = await db
    .insert(taskCodes)
    .values(taskCodeInserts)
    .returning();

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
      justificationNotes: 'Initial production rate setup',
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
    console.log(`  ${tc.code}: ${tc.name} - $${rate}/hr (${tc.isAgricultural ? 'Agricultural' : 'Non-Agricultural'})`);
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
