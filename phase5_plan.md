# Phase 5: Task Code Management - Execution Plan

## Overview

**Goal**: Enable supervisors to create and manage task codes with compliance attributes for accurate age-based filtering and payroll calculations.

**Status**: Ready to Begin

**Dependencies on Previous Phases**:
- [x] Phase 1: Project scaffolding complete
- [x] Phase 2: Database schema exists (`taskCodes`, `taskCodeRates` tables defined in Drizzle)
- [x] Phase 3: Authentication middleware (`requireAuth`, `requireSupervisor`) implemented
- [x] Phase 4: Employee CRUD patterns established (service layer, route structure, validation)

**Key Deliverables**:
1. Task code CRUD API endpoints
2. Rate versioning with effective dates
3. Age-based task filtering for timesheet entry
4. Task code management UI for supervisors
5. Seed data for initial task codes

---

## Requirements Traceability

| Requirement | Description | Phase 5 Coverage |
|-------------|-------------|------------------|
| REQ-004 | Task code time entry | Task code API enables task selection |
| REQ-009 | Hazardous task restrictions | Task codes store minAgeAllowed, hazard flags |
| REQ-016 | Task code management | Full CRUD with compliance attributes |
| P4 | Task-Age Compatibility | minAgeAllowed attribute enforced |
| P7 | Rate Version Integrity | TaskCodeRate with effectiveDate tracking |

---

## Task Breakdown

### Task 5.1: Backend - Task Code Service Layer

**Files to create/modify**:
- Create: `packages/backend/src/services/task-code.service.ts`
- Create: `packages/backend/src/errors/task-code.error.ts`

**Implementation Details**:

```typescript
// task-code.error.ts
export enum TaskCodeErrorCode {
  TASK_CODE_NOT_FOUND = 'TASK_CODE_NOT_FOUND',
  CODE_ALREADY_EXISTS = 'CODE_ALREADY_EXISTS',
  INVALID_MIN_AGE = 'INVALID_MIN_AGE',
  RATE_NOT_FOUND = 'RATE_NOT_FOUND',
  INVALID_EFFECTIVE_DATE = 'INVALID_EFFECTIVE_DATE',
}
```

**Service Functions**:

| Function | Purpose | Notes |
|----------|---------|-------|
| `listTaskCodes(options)` | List with filters | Filter by: isAgricultural, isHazardous, forAge (filter by minAgeAllowed), active status |
| `getTaskCodeById(id)` | Single task code | Include current rate + rate history |
| `getTaskCodeByCode(code)` | Lookup by code string | For UI autocomplete/validation |
| `createTaskCode(data)` | Create with initial rate | Validate code uniqueness, minAge >= 12 |
| `updateTaskCode(id, data)` | Update task code | Cannot modify code field once created |
| `getTaskCodesForEmployee(employeeAge)` | Age-filtered list | Only return tasks where minAgeAllowed <= employeeAge |
| `addRate(taskCodeId, rate, effectiveDate, notes)` | Add new rate | Effective date cannot be in the past |
| `getEffectiveRate(taskCodeId, workDate)` | Rate on a date | For payroll calculation |
| `getRateHistory(taskCodeId)` | All rates | For audit/display |

**Business Rules**:
- Task codes cannot be deleted (audit trail requirement)
- Task codes can be deactivated (soft archive)
- `minAgeAllowed` must be >= 12 (minimum employment age)
- Rate effective dates cannot be retroactive (past dates)
- Code field is immutable after creation

---

### Task 5.2: Backend - Validation Schemas

**Files to create**:
- Create: `packages/backend/src/validation/task-code.schema.ts`

**Schemas**:

```typescript
// Create task code schema
const createTaskCodeSchema = z.object({
  code: z.string().min(1).max(10).regex(/^[A-Z0-9-]+$/), // e.g., "F1", "R2"
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  isAgricultural: z.boolean(),
  isHazardous: z.boolean(),
  supervisorRequired: z.enum(['none', 'for_minors', 'always']),
  minAgeAllowed: z.number().int().min(12).max(18),
  soloCashHandling: z.boolean(),
  drivingRequired: z.boolean(),
  powerMachinery: z.boolean(),
  // Initial rate (required on creation)
  initialRate: z.number().positive(),
  rateEffectiveDate: z.string().datetime(), // ISO date
  rateJustificationNotes: z.string().max(500).optional(),
});

// Update task code schema (code is NOT updateable)
const updateTaskCodeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  isAgricultural: z.boolean().optional(),
  isHazardous: z.boolean().optional(),
  supervisorRequired: z.enum(['none', 'for_minors', 'always']).optional(),
  minAgeAllowed: z.number().int().min(12).max(18).optional(),
  soloCashHandling: z.boolean().optional(),
  drivingRequired: z.boolean().optional(),
  powerMachinery: z.boolean().optional(),
  isActive: z.boolean().optional(), // For soft archive
});

// Add rate schema
const addRateSchema = z.object({
  hourlyRate: z.number().positive(),
  effectiveDate: z.string().datetime(),
  justificationNotes: z.string().max(500).optional(),
});

// List query schema
const taskCodeListQuerySchema = z.object({
  isAgricultural: z.enum(['true', 'false']).optional(),
  isHazardous: z.enum(['true', 'false']).optional(),
  forAge: z.coerce.number().int().min(12).optional(),
  includeInactive: z.enum(['true', 'false']).optional(),
  search: z.string().optional(),
});
```

---

### Task 5.3: Backend - API Routes

**Files to create/modify**:
- Create: `packages/backend/src/routes/task-codes.ts`
- Modify: `packages/backend/src/app.ts` (add route mounting)

**Endpoints**:

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/api/task-codes` | requireAuth | List all (filtered for employee by age) |
| GET | `/api/task-codes/:id` | requireAuth | Get single with rate history |
| POST | `/api/task-codes` | requireSupervisor | Create new task code |
| PATCH | `/api/task-codes/:id` | requireSupervisor | Update task code |
| POST | `/api/task-codes/:id/rates` | requireSupervisor | Add new rate |
| GET | `/api/task-codes/:id/rates` | requireAuth | Get rate history |
| GET | `/api/task-codes/for-employee/:employeeId` | requireAuth | Age-filtered for specific employee |

**Response Shapes**:

```typescript
// GET /api/task-codes response
interface TaskCodeListResponse {
  taskCodes: TaskCodeWithCurrentRate[];
  total: number;
}

interface TaskCodeWithCurrentRate {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isAgricultural: boolean;
  isHazardous: boolean;
  supervisorRequired: 'none' | 'for_minors' | 'always';
  minAgeAllowed: number;
  soloCashHandling: boolean;
  drivingRequired: boolean;
  powerMachinery: boolean;
  isActive: boolean;
  currentRate: number; // Rate effective today
  createdAt: string;
  updatedAt: string;
}

// GET /api/task-codes/:id response
interface TaskCodeDetailResponse extends TaskCodeWithCurrentRate {
  rateHistory: TaskCodeRate[];
}

interface TaskCodeRate {
  id: string;
  hourlyRate: number;
  effectiveDate: string;
  justificationNotes: string | null;
  createdAt: string;
}
```

---

### Task 5.4: Shared Types

**Files to modify**:
- Modify: `shared/types/src/api.ts`

**Types to add**:

```typescript
export interface TaskCodePublic {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isAgricultural: boolean;
  isHazardous: boolean;
  supervisorRequired: SupervisorRequired;
  minAgeAllowed: number;
  soloCashHandling: boolean;
  drivingRequired: boolean;
  powerMachinery: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TaskCodeWithCurrentRate extends TaskCodePublic {
  currentRate: number;
}

export interface TaskCodeRate {
  id: string;
  taskCodeId: string;
  hourlyRate: number;
  effectiveDate: string;
  justificationNotes: string | null;
  createdAt: string;
}

export interface TaskCodeDetailResponse extends TaskCodeWithCurrentRate {
  rateHistory: TaskCodeRate[];
}

export interface TaskCodeListResponse {
  taskCodes: TaskCodeWithCurrentRate[];
  total: number;
}

export interface CreateTaskCodeRequest {
  code: string;
  name: string;
  description?: string;
  isAgricultural: boolean;
  isHazardous: boolean;
  supervisorRequired: SupervisorRequired;
  minAgeAllowed: number;
  soloCashHandling: boolean;
  drivingRequired: boolean;
  powerMachinery: boolean;
  initialRate: number;
  rateEffectiveDate: string;
  rateJustificationNotes?: string;
}

export interface UpdateTaskCodeRequest {
  name?: string;
  description?: string;
  isAgricultural?: boolean;
  isHazardous?: boolean;
  supervisorRequired?: SupervisorRequired;
  minAgeAllowed?: number;
  soloCashHandling?: boolean;
  drivingRequired?: boolean;
  powerMachinery?: boolean;
  isActive?: boolean;
}

export interface AddRateRequest {
  hourlyRate: number;
  effectiveDate: string;
  justificationNotes?: string;
}
```

---

### Task 5.5: Update Database Schema (if needed)

**Files to review/modify**:
- Review: `packages/backend/src/db/schema/task-codes.ts`

**Verify schema includes**:
- `isActive` boolean column (for soft archive) - add if missing
- All compliance attributes present
- Proper foreign key relationships

**Migration** (if schema changes needed):
```bash
cd packages/backend
npx drizzle-kit generate
npx drizzle-kit migrate
```

---

### Task 5.6: Frontend - API Client

**Files to modify**:
- Modify: `packages/frontend/src/api/client.ts`

**Functions to add**:

```typescript
// Task Code API
export const taskCodesApi = {
  list: async (params?: TaskCodeListParams): Promise<TaskCodeListResponse> => {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return apiRequest(`/api/task-codes${query ? `?${query}` : ''}`);
  },

  getById: async (id: string): Promise<TaskCodeDetailResponse> => {
    return apiRequest(`/api/task-codes/${id}`);
  },

  create: async (data: CreateTaskCodeRequest): Promise<TaskCodeWithCurrentRate> => {
    return apiRequest('/api/task-codes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (id: string, data: UpdateTaskCodeRequest): Promise<TaskCodeWithCurrentRate> => {
    return apiRequest(`/api/task-codes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  addRate: async (id: string, data: AddRateRequest): Promise<TaskCodeRate> => {
    return apiRequest(`/api/task-codes/${id}/rates`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getRateHistory: async (id: string): Promise<TaskCodeRate[]> => {
    return apiRequest(`/api/task-codes/${id}/rates`);
  },

  getForEmployee: async (employeeId: string): Promise<TaskCodeListResponse> => {
    return apiRequest(`/api/task-codes/for-employee/${employeeId}`);
  },
};
```

---

### Task 5.7: Frontend - Task Code Hooks

**Files to create**:
- Create: `packages/frontend/src/hooks/useTaskCodes.ts`

**Hooks**:

```typescript
export function useTaskCodes(params?: TaskCodeListParams) {
  // Fetch task code list with loading/error state
}

export function useTaskCode(id: string) {
  // Fetch single task code with rate history
}

export function useTaskCodesForEmployee(employeeId: string) {
  // Age-filtered task codes for timesheet entry
}

export function useTaskCodeActions() {
  return {
    createTaskCode,
    updateTaskCode,
    addRate,
    archiveTaskCode,
  };
}
```

---

### Task 5.8: Frontend - Task Code List Page

**Files to create**:
- Create: `packages/frontend/src/pages/TaskCodeList.tsx`

**Features**:
- Table with columns: Code, Name, Classification (Ag/Non-Ag), Min Age, Current Rate, Status
- Filters: Agricultural/Non-Agricultural, Hazardous, Age range, Active/Inactive
- Search by code or name
- "Add Task Code" button (supervisor only)
- Click row to navigate to detail page
- Visual indicators for hazardous tasks (warning icon)
- Badge showing supervisor requirement level

**UI Components**:
- TaskCodeTable - Data table with sorting
- TaskCodeFilters - Filter controls
- TaskCodeStatusBadge - Active/Inactive indicator
- HazardIndicator - Warning icon for hazardous tasks
- AgeRestrictionBadge - Shows minimum age

---

### Task 5.9: Frontend - Task Code Detail Page

**Files to create**:
- Create: `packages/frontend/src/pages/TaskCodeDetail.tsx`

**Features**:
- Task code information display
- All compliance attributes with clear labels
- Current rate prominently displayed
- Rate history table (date, rate, justification notes)
- "Edit" button (supervisor only)
- "Add New Rate" button (supervisor only)
- "Archive" button (supervisor only, with confirmation)

---

### Task 5.10: Frontend - Task Code Form Components

**Files to create**:
- Create: `packages/frontend/src/components/TaskCodeForm.tsx`
- Create: `packages/frontend/src/components/AddRateModal.tsx`

**TaskCodeForm Features**:
- Used for both create and edit modes
- Code field (disabled in edit mode)
- Name and description
- Classification toggle (Agricultural/Non-Agricultural)
- Compliance attribute checkboxes:
  - Hazardous work
  - Solo cash handling
  - Driving required
  - Power machinery
- Supervisor required dropdown (None / For Minors / Always)
- Minimum age allowed (12-18 dropdown)
- Initial rate (create mode only)
- Effective date picker
- Justification notes textarea

**AddRateModal Features**:
- New hourly rate input (currency format)
- Effective date picker (cannot be past)
- Justification notes (optional but encouraged)
- Validation before submit

---

### Task 5.11: Frontend - Routing

**Files to modify**:
- Modify: `packages/frontend/src/App.tsx` or router config

**Routes to add**:
```typescript
/task-codes                    // TaskCodeList (supervisor only)
/task-codes/new               // TaskCodeForm create mode (supervisor only)
/task-codes/:id               // TaskCodeDetail
/task-codes/:id/edit          // TaskCodeForm edit mode (supervisor only)
```

**Navigation**:
- Add "Task Codes" link to supervisor navigation menu

---

### Task 5.12: Seed Initial Task Codes

**Files to modify**:
- Review/Update: `packages/backend/src/db/seed.ts`

**Verify seed data includes** (per requirements.md example tasks):

| Code | Name | Type | Min Age | Rate | Hazardous | Supervisor |
|------|------|------|---------|------|-----------|------------|
| F1 | Field Preparation | Agricultural | 12 | $8.00 | No | None |
| F2 | Planting | Agricultural | 12 | $8.00 | No | None |
| F3 | Cultivation/Weeding | Agricultural | 12 | $8.00 | No | None |
| F4 | Harvesting | Agricultural | 12 | $8.00 | No | None |
| F5 | Livestock Care - Basic | Agricultural | 14 | $8.00 | No | For Minors |
| F6 | Equipment Operation | Agricultural | 18 | $8.00 | Yes | Always |
| R1 | Farm Stand Sales | Non-Agricultural | 14 | $15.00 | No | For Minors |
| R2 | Farmers Market/Retail | Non-Agricultural | 14 | $15.00 | No | Always |
| R3 | Cash Handling | Non-Agricultural | 14 | $15.00 | No | For Minors |
| A1 | Office/Admin | Non-Agricultural | 16 | $15.00 | No | None |
| A2 | Data Entry | Non-Agricultural | 14 | $15.00 | No | None |
| M1 | Light Maintenance | Non-Agricultural | 16 | $15.00 | No | None |
| M2 | Heavy Equipment | Non-Agricultural | 18 | $15.00 | Yes | Always |
| D1 | Delivery Driving | Non-Agricultural | 18 | $15.00 | Yes | None |

---

### Task 5.13: Backend Unit Tests

**Files to create**:
- Create: `packages/backend/src/services/__tests__/task-code.service.test.ts`

**Test Cases**:

1. **listTaskCodes**
   - Returns all active task codes
   - Filters by isAgricultural
   - Filters by isHazardous
   - Filters by forAge (minAgeAllowed <= age)
   - Includes inactive when requested
   - Search by code and name

2. **createTaskCode**
   - Creates with all required fields
   - Rejects duplicate code
   - Rejects minAgeAllowed < 12
   - Creates initial rate record

3. **updateTaskCode**
   - Updates allowed fields
   - Cannot update code field
   - Can deactivate (archive)
   - Updates timestamp

4. **Rate versioning**
   - addRate creates new rate record
   - getEffectiveRate returns correct rate for date
   - Cannot add rate with past effective date
   - Rate history is ordered by date descending

5. **getTaskCodesForEmployee**
   - Filters by employee's age correctly
   - 12-year-old only sees minAge <= 12 tasks
   - 18+ sees all tasks
   - Only returns active task codes

---

### Task 5.14: Backend Integration Tests

**Files to create**:
- Create: `packages/backend/src/routes/__tests__/task-codes.test.ts`

**Test Cases**:

1. **GET /api/task-codes**
   - Returns list for authenticated user
   - Filters work correctly
   - Returns 401 for unauthenticated

2. **POST /api/task-codes**
   - Creates task code for supervisor
   - Returns 403 for non-supervisor
   - Returns 400 for invalid data
   - Returns 409 for duplicate code

3. **PATCH /api/task-codes/:id**
   - Updates for supervisor
   - Returns 403 for non-supervisor
   - Returns 404 for non-existent

4. **POST /api/task-codes/:id/rates**
   - Adds rate for supervisor
   - Validates effective date not in past
   - Returns new rate record

5. **GET /api/task-codes/for-employee/:id**
   - Returns age-appropriate tasks
   - Different results for different ages

---

### Task 5.15: Frontend Component Tests

**Files to create**:
- Create: `packages/frontend/src/pages/__tests__/TaskCodeList.test.tsx`
- Create: `packages/frontend/src/pages/__tests__/TaskCodeDetail.test.tsx`
- Create: `packages/frontend/src/components/__tests__/TaskCodeForm.test.tsx`

**Test Cases**:

1. **TaskCodeList**
   - Renders task code table
   - Filters update URL params
   - Search filters results
   - Add button visible for supervisors only
   - Navigate to detail on row click

2. **TaskCodeDetail**
   - Displays task code information
   - Shows rate history
   - Edit button visible for supervisors
   - Archive button with confirmation
   - Add rate modal opens/closes

3. **TaskCodeForm**
   - Validates required fields
   - Code field disabled in edit mode
   - Submits correctly formatted data
   - Shows validation errors

---

### Task 5.16: E2E Tests

**Files to create**:
- Create: `e2e/tests/task-codes.spec.ts`

**Test Scenarios**:

1. **Supervisor creates task code**
   - Login as supervisor
   - Navigate to task codes
   - Click "Add Task Code"
   - Fill form with all fields
   - Submit and verify created
   - Verify appears in list

2. **Supervisor updates task code**
   - Navigate to task code detail
   - Click edit
   - Modify fields
   - Save and verify changes

3. **Supervisor adds new rate**
   - Navigate to task code detail
   - Click "Add Rate"
   - Enter new rate and effective date
   - Verify appears in rate history

4. **Employee sees age-filtered tasks**
   - Login as 14-year-old employee
   - View task code list
   - Verify only age-appropriate tasks visible

5. **Task code archive flow**
   - Archive a task code
   - Verify no longer in default list
   - Verify visible with "include inactive" filter

---

## Acceptance Criteria Checklist

From REQ-016 (Task Code Management):

- [ ] System allows supervisors to create task codes with: code, name, description, hourly rate, effective date
- [ ] System requires classification as Agricultural or Non-Agricultural
- [ ] System requires hazardous flag (yes/no)
- [ ] System requires supervisor-required flag (none/for_minors/always)
- [ ] System requires minimum age allowed
- [ ] System requires attributes for: solo cash handling, driving, power machinery
- [ ] System preserves historical task code versions (rate versioning with effective dates)
- [ ] System allows rate justification notes for audit documentation

From REQ-004 (Task Code Time Entry - partial):

- [ ] System displays task codes filtered by employee age (hiding age-inappropriate tasks)
- [ ] System shows task name, description, and hourly rate for each selectable task

From P4 (Task-Age Compatibility):

- [ ] Task code's minimum age attribute enforced in API filtering

From P7 (Rate Version Integrity):

- [ ] Historical rates preserved with effective dates
- [ ] getEffectiveRate returns correct rate for any work date

---

## Implementation Order

```
5.1  Backend Service Layer        ─┐
5.2  Validation Schemas           ─┼─ Backend Core (do first)
5.3  API Routes                   ─┤
5.4  Shared Types                 ─┘
         │
         ▼
5.5  Database Schema Review       ─── Verify/migrate if needed
         │
         ▼
5.12 Seed Data                    ─── Update seed script
         │
         ▼
5.13 Backend Unit Tests           ─┐
5.14 Backend Integration Tests    ─┴─ Backend Testing
         │
         ▼
5.6  Frontend API Client          ─┐
5.7  Frontend Hooks               ─┤
5.8  Task Code List Page          ─┼─ Frontend Features
5.9  Task Code Detail Page        ─┤
5.10 Form Components              ─┤
5.11 Routing                      ─┘
         │
         ▼
5.15 Frontend Component Tests     ─┐
5.16 E2E Tests                    ─┴─ Frontend Testing
```

---

## Estimated Complexity

| Task | Complexity | Notes |
|------|------------|-------|
| 5.1 Service Layer | Medium | Core business logic, follows employee pattern |
| 5.2 Validation | Low | Straightforward Zod schemas |
| 5.3 API Routes | Low | Standard CRUD pattern |
| 5.4 Shared Types | Low | Type definitions |
| 5.5 Schema Review | Low | Likely minimal changes |
| 5.6-5.7 API Client/Hooks | Low | Standard patterns |
| 5.8-5.10 UI Pages | Medium | New pages and components |
| 5.11 Routing | Low | Add routes |
| 5.12 Seed Data | Low | Verify/expand existing |
| 5.13-5.16 Tests | Medium | Comprehensive coverage |

---

## Dependencies for Next Phase

Phase 6 (Timesheet Entry Interface) will depend on:

- `GET /api/task-codes/for-employee/:id` endpoint for task dropdown
- `TaskCodeWithCurrentRate` type for display
- Task filtering by employee age working correctly

---

## Notes

1. **No delete operation**: Task codes are never deleted due to audit trail requirements. Use `isActive: false` for soft archive.

2. **Rate versioning**: New rates can only have future or current effective dates, never past dates. This prevents retroactive changes that could affect historical payroll.

3. **Compliance attributes inform Phase 7**: The flags stored here (isHazardous, minAgeAllowed, etc.) will be used by the compliance rule engine to validate timesheet entries.

4. **Agricultural vs Non-Agricultural**: This classification affects both minimum wage floors ($8 vs $15) and overtime exemptions.
