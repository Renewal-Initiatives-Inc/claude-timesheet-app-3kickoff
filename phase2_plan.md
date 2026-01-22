# Phase 2: Database Schema & ORM Setup - Detailed Execution Plan

## Overview

**Goal**: Implement the data model from design.md with type-safe database access.

**Deliverable**: Fully migrated database with seed data, ORM configured and tested.

---

## 1. ORM Decision: Drizzle ORM

### Recommendation: Drizzle ORM (not Prisma)

**Rationale**:
1. **Serverless Optimization**: Near-zero cold start overhead, critical for Vercel Functions
2. **SQL Transparency**: Generates predictable SQL for compliance rule verification
3. **TypeScript-Native**: Schema defined in TypeScript, types inferred automatically
4. **Lightweight**: ~47KB vs Prisma's larger footprint
5. **Vercel Postgres**: Native `drizzle-orm/vercel-postgres` adapter
6. **JSONB Support**: Native PostgreSQL JSONB for ComplianceCheckLog.details

**Tradeoffs Accepted**:
- Less "batteries included" than Prisma (acceptable for project simplicity)
- Smaller community (sufficient for this use case)

---

## 2. Project Structure

### New Files to Create

```
packages/backend/
├── drizzle.config.ts                    # Drizzle Kit configuration
├── src/
│   ├── db/
│   │   ├── index.ts                     # Database client export
│   │   ├── schema/
│   │   │   ├── index.ts                 # Re-exports all schemas
│   │   │   ├── enums.ts                 # PostgreSQL enum definitions
│   │   │   ├── employee.ts              # Employee & EmployeeDocument
│   │   │   ├── task-code.ts             # TaskCode & TaskCodeRate
│   │   │   ├── timesheet.ts             # Timesheet & TimesheetEntry
│   │   │   ├── compliance.ts            # ComplianceCheckLog
│   │   │   └── payroll.ts               # PayrollRecord
│   │   ├── migrations/                  # Generated SQL migrations
│   │   └── seed.ts                      # Seed script
│   ├── utils/
│   │   ├── age.ts                       # Age calculation helper
│   │   └── timezone.ts                  # America/New_York helpers
│   └── __tests__/
│       ├── utils/
│       │   └── age.test.ts              # Age calculation tests
│       └── db/
│           └── schema.test.ts           # Database integration tests

shared/types/src/
├── db.ts                                # Database entity types
└── index.ts                             # Updated exports
```

---

## 3. Specific Tasks

### Task 1: Install Dependencies

**File**: `packages/backend/package.json`

Add dependencies:
```json
{
  "dependencies": {
    "drizzle-orm": "^0.38.0",
    "@vercel/postgres": "^0.10.0",
    "pg": "^8.13.0"
  },
  "devDependencies": {
    "drizzle-kit": "^0.30.0",
    "@types/pg": "^8.11.0"
  }
}
```

Add scripts:
```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "db:seed": "tsx src/db/seed.ts"
  }
}
```

---

### Task 2: Configure Drizzle

**File**: `packages/backend/drizzle.config.ts`

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
```

---

### Task 3: Create Database Client

**File**: `packages/backend/src/db/index.ts`

Conditional client for local vs Vercel:
- Local: `drizzle-orm/node-postgres` with pg Pool
- Production: `drizzle-orm/vercel-postgres` with @vercel/postgres

---

### Task 4: Create Schema Files

#### 4.1 Enums (`schema/enums.ts`)
- `employee_status`: active | archived
- `document_type`: parental_consent | work_permit | safety_training
- `supervisor_required`: none | for_minors | always
- `timesheet_status`: open | submitted | approved | rejected
- `compliance_result`: pass | fail | not_applicable

#### 4.2 Employee Schema (`schema/employee.ts`)
**Tables**:
- `employees`: id, name, email (unique), dateOfBirth, isSupervisor, status, passwordHash, failedLoginAttempts, lockedUntil, createdAt, updatedAt
- `employee_documents`: id, employeeId (FK), type, filePath, uploadedAt, uploadedBy (FK), expiresAt, invalidatedAt

**Relations**:
- Employee has many documents, timesheets
- Document belongs to employee, uploaded by supervisor

#### 4.3 Task Code Schema (`schema/task-code.ts`)
**Tables**:
- `task_codes`: id, code (unique), name, description, isAgricultural, isHazardous, supervisorRequired, soloCashHandling, drivingRequired, powerMachinery, minAgeAllowed, createdAt, updatedAt
- `task_code_rates`: id, taskCodeId (FK), hourlyRate (decimal), effectiveDate, justificationNotes, createdAt

**Relations**:
- TaskCode has many rates (versioning)

#### 4.4 Timesheet Schema (`schema/timesheet.ts`)
**Tables**:
- `timesheets`: id, employeeId (FK), weekStartDate, status, submittedAt, reviewedBy (FK), reviewedAt, supervisorNotes, createdAt, updatedAt
- `timesheet_entries`: id, timesheetId (FK), workDate, taskCodeId (FK), startTime, endTime, hours (decimal), isSchoolDay, schoolDayOverrideNote, supervisorPresentName, mealBreakConfirmed, createdAt

**Relations**:
- Timesheet belongs to employee, reviewed by supervisor
- Timesheet has many entries
- Entry belongs to timesheet, task code

#### 4.5 Compliance Schema (`schema/compliance.ts`)
**Table**:
- `compliance_check_logs`: id, timesheetId (FK), ruleId, result, details (JSONB), checkedAt, employeeAgeOnDate

**JSONB Type**:
```typescript
type ComplianceDetails = {
  ruleDescription: string;
  checkedValues: Record<string, unknown>;
  threshold?: number | string;
  actualValue?: number | string;
  message?: string;
};
```

#### 4.6 Payroll Schema (`schema/payroll.ts`)
**Table**:
- `payroll_records`: id, timesheetId (FK, unique), employeeId (FK), periodStart, periodEnd, agriculturalHours, agriculturalEarnings, nonAgriculturalHours, nonAgriculturalEarnings, overtimeHours, overtimeEarnings, totalEarnings, calculatedAt, exportedAt

---

### Task 5: Create Age Calculation Utility

**File**: `packages/backend/src/utils/age.ts`

**Functions**:
1. `calculateAge(dateOfBirth, asOfDate)`: Returns age in whole years
2. `getAgeBand(age)`: Returns '12-13' | '14-15' | '16-17' | '18+'
3. `checkBirthdayInWeek(dateOfBirth, weekStartDate)`: Detects birthday within week
4. `getWeeklyAges(dateOfBirth, weekStartDate)`: Map of dates to ages for the week

**Critical for**: REQ-020 (birthday mid-period), RULE-031 (age per work date)

---

### Task 6: Create Timezone Utility

**File**: `packages/backend/src/utils/timezone.ts`

**Constants/Functions**:
- `TIMEZONE = 'America/New_York'`
- `getTodayET()`: Current date in Eastern Time
- `getWeekStartDate(date)`: Sunday for given date
- `timeToMinutes(time)`: Parse HH:MM to minutes
- `isWithinSchoolHours(time)`: Check 7 AM - 3 PM

**Critical for**: REQ-029 (Eastern Time for all rules)

---

### Task 7: Update Environment Config

**File**: `packages/backend/src/config/env.ts`

Change `DATABASE_URL` from optional to required:
```typescript
DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL URL'),
```

---

### Task 8: Create Shared Types

**File**: `shared/types/src/db.ts`

Export frontend-safe types matching Drizzle schema:
- `Employee`, `EmployeeDocument`
- `TaskCode`, `TaskCodeRate`
- `Timesheet`, `TimesheetEntry`
- `ComplianceCheckLog`, `ComplianceDetails`
- `PayrollRecord`
- Enum types: `EmployeeStatus`, `TimesheetStatus`, `AgeBand`, etc.

**Update**: `shared/types/src/index.ts` to export db.ts

---

### Task 9: Create Seed Script

**File**: `packages/backend/src/db/seed.ts`

**Test Data**:

| Employee | Age | Purpose |
|----------|-----|---------|
| Sarah Supervisor | Adult | Supervisor account |
| Alex Age12 | 12 | 12-13 band testing |
| Blake Age13 | 13 | 12-13 band testing |
| Casey Age14 | 14 | 14-15 band testing |
| Dana Age15 | 15 | 14-15 band testing |
| Ellis Age16 | 16 | 16-17 band testing |
| Finley Age17 | 17 | 16-17 band testing |
| Gray Adult | 22 | 18+ testing |
| Harper BirthdaySoon | 13→14 | Age transition testing |

**Task Codes** (from requirements):
- F1-F6: Field work (agricultural, varying restrictions)
- R1-R3: Retail (non-agricultural)
- A1-A2: Administrative
- M1-M2: Maintenance
- D1: Delivery (driving required, 18+)

**Initial Rates**: $8/hr agricultural, $15/hr non-agricultural

---

### Task 10: Write Tests

#### Age Calculation Tests (`__tests__/utils/age.test.ts`)
- `calculateAge`: Before/on/after birthday, year boundary, leap years
- `getAgeBand`: All bands, throws for age < 12
- `checkBirthdayInWeek`: Birthday in week, not in week, boundaries
- `getWeeklyAges`: Same age all week, different ages mid-week birthday

#### Database Integration Tests (`__tests__/db/schema.test.ts`)
- Create employee with required fields
- Unique email constraint
- Task code with compliance attributes
- Rate versioning (multiple rates per task code)
- Skip if no DATABASE_URL (CI without DB)

---

### Task 11: Create Postgres Database via Vercel Marketplace

> **Note**: As of December 2024, Vercel Postgres was discontinued and replaced with
> Marketplace integrations. Neon is the recommended Postgres provider.

**Steps**:

1. **Import project to Vercel** (if not already done):
   - Go to https://vercel.com/dashboard
   - Click "Add New..." → "Project"
   - Import your GitHub repository

2. **Install Neon Postgres from Marketplace**:
   - From your Vercel dashboard, go to the **Integrations** tab
   - Click **Browse Marketplace**
   - Search for "Neon" under Native Integrations
   - Click **Install**

3. **Configure Neon database**:
   - Select "Create New Neon Account" (billing managed through Vercel)
   - Accept terms of service
   - Select region (e.g., `us-east-1` for US East)
   - Choose plan (Free tier available for development)
   - Name your database: `renewal-timesheet-db`
   - Click **Create**

4. **Connect database to project**:
   - After creation, you'll land on Vercel's **Storage** tab
   - Select your database
   - Under **Projects**, click **Connect Project**
   - Select your project and environments (Development, Preview, Production)
   - **Recommended**: Enable "Preview" under Advanced Deployment Configuration for branch databases

5. **Pull environment variables to local**:
   ```bash
   vercel link  # Link local project to Vercel (if not done)
   vercel env pull .env.local
   ```

6. **Verify connection string**:
   ```bash
   # Check that .env.local contains DATABASE_URL
   grep DATABASE_URL .env.local
   ```

**Verification**:
```bash
# Test connection with Drizzle Studio
cd packages/backend
npm run db:studio
# Should open browser and connect to database
```

**Environment Variables Created by Neon Integration**:
| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Pooled connection string (via PgBouncer) - **use this for app** |
| `DATABASE_URL_UNPOOLED` | Direct connection (for migrations) |
| `PGHOST` | Database host |
| `PGHOST_UNPOOLED` | Direct database host |
| `PGUSER` | Database username |
| `PGDATABASE` | Database name |
| `PGPASSWORD` | Database password |
| `POSTGRES_URL` | Legacy alias (backwards compatibility) |
| `POSTGRES_URL_NON_POOLING` | Legacy alias for unpooled connection |

**Drizzle Configuration Note**:
The current `drizzle.config.ts` uses `DATABASE_URL`, which matches the Neon integration.
No changes needed.

---

## 4. Implementation Sequence

Execute in this order:

1. Install dependencies (`npm install`)
2. Create `drizzle.config.ts`
3. Create `src/db/schema/enums.ts`
4. Create `src/db/schema/employee.ts`
5. Create `src/db/schema/task-code.ts`
6. Create `src/db/schema/timesheet.ts`
7. Create `src/db/schema/compliance.ts`
8. Create `src/db/schema/payroll.ts`
9. Create `src/db/schema/index.ts`
10. Create `src/db/index.ts` (database client)
11. Create `src/utils/age.ts`
12. Create `src/utils/timezone.ts`
13. Update `src/config/env.ts` (DATABASE_URL handling)
14. Create `shared/types/src/db.ts`
15. Update `shared/types/src/index.ts`
16. Write `src/__tests__/utils/age.test.ts`
17. **Create Vercel Postgres database** (Task 11)
18. **Pull DATABASE_URL to .env.local**
19. Run `npm run db:generate` (generate migration)
20. Run `npm run db:migrate` (apply migration)
21. Create `src/db/seed.ts`
22. Run `npm run db:seed`
23. Write `src/__tests__/db/schema.test.ts`
24. Run `npm run test` (all tests including DB integration)

---

## 5. Acceptance Criteria Coverage

| Requirement | How Satisfied |
|-------------|---------------|
| REQ-001 | Employee table with dateOfBirth, status |
| REQ-002 | EmployeeDocument table with type, expiresAt |
| REQ-014 | TaskCodeRate with effectiveDate for rate versioning |
| REQ-016 | Task code compliance attributes (isHazardous, minAgeAllowed, etc.) |
| REQ-020 | `calculateAge()` and `getWeeklyAges()` for per-date age |
| REQ-022 | No DELETE operations, soft delete via status/invalidatedAt |
| REQ-029 | Timezone utilities for America/New_York |
| RULE-031 | Birthday mid-period handling via age utilities |

---

## 6. Dependencies from Phase 1

**Verified Present**:
- [x] Monorepo structure (`packages/backend`, `shared/types`)
- [x] TypeScript with project references
- [x] Vitest configured
- [x] Environment config with Zod (`src/config/env.ts`)
- [x] Express server running

---

## 7. Verification Steps

After implementation, run:

```bash
# Type safety
npm run typecheck

# Unit tests (age calculations)
npm run test

# Generate migration SQL
cd packages/backend
npm run db:generate

# Review migration file in src/db/migrations/

# Apply migration (requires DATABASE_URL)
npm run db:migrate

# Seed test data
npm run db:seed

# Visual inspection
npm run db:studio

# Full test suite
cd ../..
npm run test
```

**Manual Verification**:
1. Open Drizzle Studio, verify all tables created
2. Verify seed data: employees across age bands, task codes with rates
3. Test age calculation: employee with birthday mid-week shows different ages per day
4. Verify shared types: `import { Employee } from '@renewal/types'` works in frontend

---

## 8. Potential Issues & Mitigations

| Issue | Mitigation |
|-------|------------|
| Local vs Vercel connection differences | Conditional client in db/index.ts |
| Decimal precision for rates/hours | Store as string, convert in business logic |
| Migration ordering issues | Generate one migration at a time |
| Test database isolation | Use unique emails/codes with timestamps |
| Cold start on Vercel | Drizzle's minimal footprint helps |

---

## 9. Next Phase Preview

Phase 3 (Authentication) will build on:
- `employees.passwordHash` field (created but not used yet)
- `employees.failedLoginAttempts` and `lockedUntil` fields
- Database client for session storage

---

## 10. Completion Status

**Status**: ✅ COMPLETE (2026-01-21)

### Tasks Completed:
- [x] Task 1: Install Dependencies (drizzle-orm, drizzle-kit, pg, @types/pg)
- [x] Task 2: Configure Drizzle (drizzle.config.ts)
- [x] Task 3: Create Database Client (src/db/index.ts)
- [x] Task 4: Create Schema Files (all 6 schema files)
- [x] Task 5: Create Age Calculation Utility (src/utils/age.ts)
- [x] Task 6: Create Timezone Utility (src/utils/timezone.ts)
- [x] Task 7: Update Environment Config (DATABASE_URL handling with runtime validation)
- [x] Task 8: Create Shared Types (shared/types/src/db.ts)
- [x] Task 9: Create Seed Script (src/db/seed.ts)
- [x] Task 10: Write Tests (age.test.ts, schema.test.ts)
- [x] Task 11: Create Postgres Database via Vercel/Neon Marketplace

### Database State:
- Migration applied: `0000_worried_payback.sql` (8 tables created)
- Seed data: 9 employees, 7 documents, 14 task codes, 14 task code rates

### Test Results:
- 48 tests passing (22 age tests, 3 health tests, 4 frontend tests, 19 DB integration tests)
- All typecheck, lint passing

### Issues Resolved:
See [docs/troubleshooting/drizzle-kit-version-error.md](docs/troubleshooting/drizzle-kit-version-error.md) for:
- npm workspaces dependency hoisting (installed drizzle packages at root)
- ESM module resolution conflict (changed to `moduleResolution: Bundler`)
- Drizzle relation ambiguity (added `relationName` for multi-FK relations)

### Deviations from Plan:
- Task 7: DATABASE_URL kept optional in schema but enforced at runtime (allows tests to skip DB tests gracefully)
