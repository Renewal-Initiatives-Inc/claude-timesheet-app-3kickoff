/**
 * Database seed script for development and testing.
 *
 * Creates test employees across all age bands and task codes
 * with initial rates for compliance rule testing.
 *
 * Run with: npm run db:seed
 */

import { db, schema } from './index.js';
import { eq } from 'drizzle-orm';

const { employees, employeeDocuments, taskCodes, taskCodeRates } = schema;

// Calculate date of birth for a target age
function dobForAge(age: number): string {
  const today = new Date();
  const year = today.getFullYear() - age;
  // Use Jan 15 for most test employees
  return `${year}-01-15`;
}

// Calculate DOB for someone who will turn 14 in 2 weeks (for age transition testing)
function dobForUpcomingBirthday(): string {
  const today = new Date();
  today.setDate(today.getDate() + 14);
  const year = today.getFullYear() - 14;
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function seed() {
  console.log('Starting database seed...');

  // Check if already seeded by looking for the supervisor
  const existingSupervisor = await db
    .select()
    .from(employees)
    .where(eq(employees.email, 'sarah.supervisor@renewal.org'))
    .limit(1);

  if (existingSupervisor.length > 0) {
    console.log('Database already seeded. Skipping...');
    console.log('To reseed, delete existing data first.');
    process.exit(0);
  }

  // Create employees across all age bands
  console.log('Creating test employees...');

  const testEmployees = [
    {
      name: 'Sarah Supervisor',
      email: 'sarah.supervisor@renewal.org',
      dateOfBirth: dobForAge(35),
      isSupervisor: true,
    },
    {
      name: 'Alex Age12',
      email: 'alex.age12@renewal.org',
      dateOfBirth: dobForAge(12),
      isSupervisor: false,
    },
    {
      name: 'Blake Age13',
      email: 'blake.age13@renewal.org',
      dateOfBirth: dobForAge(13),
      isSupervisor: false,
    },
    {
      name: 'Casey Age14',
      email: 'casey.age14@renewal.org',
      dateOfBirth: dobForAge(14),
      isSupervisor: false,
    },
    {
      name: 'Dana Age15',
      email: 'dana.age15@renewal.org',
      dateOfBirth: dobForAge(15),
      isSupervisor: false,
    },
    {
      name: 'Ellis Age16',
      email: 'ellis.age16@renewal.org',
      dateOfBirth: dobForAge(16),
      isSupervisor: false,
    },
    {
      name: 'Finley Age17',
      email: 'finley.age17@renewal.org',
      dateOfBirth: dobForAge(17),
      isSupervisor: false,
    },
    {
      name: 'Gray Adult',
      email: 'gray.adult@renewal.org',
      dateOfBirth: dobForAge(22),
      isSupervisor: false,
    },
    {
      name: 'Harper BirthdaySoon',
      email: 'harper.birthdaysoon@renewal.org',
      dateOfBirth: dobForUpcomingBirthday(),
      isSupervisor: false,
    },
  ];

  const insertedEmployees = await db.insert(employees).values(testEmployees).returning();
  console.log(`Created ${insertedEmployees.length} employees`);

  const supervisor = insertedEmployees.find((e) => e.isSupervisor)!;

  // Create parental consent documents for minors
  console.log('Creating employee documents...');
  const minors = insertedEmployees.filter(
    (e) => !e.isSupervisor && e.name !== 'Gray Adult'
  );

  const documents = minors.map((minor) => ({
    employeeId: minor.id,
    type: 'parental_consent' as const,
    filePath: `/documents/consent/${minor.id}.pdf`,
    uploadedBy: supervisor.id,
  }));

  const insertedDocs = await db.insert(employeeDocuments).values(documents).returning();
  console.log(`Created ${insertedDocs.length} documents`);

  // Create task codes
  console.log('Creating task codes...');

  const taskCodeData = [
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
    },
  ];

  const insertedTaskCodes = await db.insert(taskCodes).values(taskCodeData).returning();
  console.log(`Created ${insertedTaskCodes.length} task codes`);

  // Create initial rates for each task code
  console.log('Creating task code rates...');

  const today = new Date().toISOString().split('T')[0]!;
  const rates = insertedTaskCodes.map((tc) => ({
    taskCodeId: tc.id,
    // Agricultural tasks get lower rate ($8/hr), non-agricultural $15/hr
    hourlyRate: tc.isAgricultural ? '8.00' : '15.00',
    effectiveDate: today,
    justificationNotes: 'Initial rate setup',
  }));

  const insertedRates = await db.insert(taskCodeRates).values(rates).returning();
  console.log(`Created ${insertedRates.length} task code rates`);

  console.log('\nSeed completed successfully!');
  console.log('\nSummary:');
  console.log(`- ${insertedEmployees.length} employees (1 supervisor, ${minors.length} minors, 1 adult)`);
  console.log(`- ${insertedDocs.length} documents (parental consent for minors)`);
  console.log(`- ${insertedTaskCodes.length} task codes`);
  console.log(`- ${insertedRates.length} task code rates`);

  process.exit(0);
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
