# Phase 9: Payroll Calculation & Export - Execution Plan

## Overview

**Goal**: Calculate pay accurately with multi-rate and overtime support, create payroll records on approval, and provide CSV export for accounting.

**Deliverable**: Accurate payroll calculations triggered on timesheet approval with CSV export for accounting system.

---

## Prerequisites & Dependencies

### From Previous Phases (Verify Before Starting)

1. **Phase 2 - Database Schema**
   - [ ] `payroll_records` table exists with all required columns
   - [ ] `task_code_rates` table supports rate versioning with `effective_date`
   - [ ] Decimal types used for monetary fields

2. **Phase 5 - Task Code Management**
   - [ ] Task codes have `is_agricultural` boolean field
   - [ ] Task code rates have `effective_date` and `hourly_rate` fields
   - [ ] Rate versioning queries work correctly

3. **Phase 6 - Timesheet Entry**
   - [ ] Timesheet entries store `task_code_id` and `hours`
   - [ ] `work_date` stored for each entry

4. **Phase 8 - Submission & Review Workflow**
   - [ ] `approveTimesheet()` function exists in review service
   - [ ] Timesheet status transitions to `'approved'` on approval
   - [ ] Supervisor review UI functional

---

## Tasks

### Task 1: Payroll Calculation Service

**File to create**: `packages/backend/src/services/payroll.service.ts`

**Functions to implement**:

```typescript
// Get the effective rate for a task code on a specific date
getEffectiveRateForDate(taskCodeId: string, workDate: Date): Promise<Decimal>

// Calculate payroll for an approved timesheet
calculatePayrollForTimesheet(timesheetId: string): Promise<PayrollRecord>

// Get existing payroll record for a timesheet
getPayrollRecord(timesheetId: string): Promise<PayrollRecord | null>

// List payroll records with filters
listPayrollRecords(filters: PayrollFilters): Promise<PayrollRecord[]>
```

**Business Logic**:

1. **Rate Lookup**:
   - Query `task_code_rates` where `effective_date <= workDate`
   - Order by `effective_date DESC`, take first result
   - Throw error if no rate found for date

2. **Payroll Calculation**:
   - Fetch timesheet with all entries and task codes
   - For each entry:
     - Get task code's `is_agricultural` flag
     - Get effective rate for task code on entry's work_date
     - Calculate: `hours × rate`
     - Accumulate by classification (agricultural vs non-agricultural)

3. **Minimum Wage Validation**:
   - Agricultural floor: $8.00/hr
   - Non-agricultural floor: $15.00/hr
   - Log warning if any rate < floor (should not occur but validate)

4. **Overtime Calculation** (non-agricultural only):
   - If total non-agricultural hours > 40:
     - Weighted average rate = `non_ag_earnings / non_ag_hours`
     - Overtime hours = `non_ag_hours - 40`
     - Overtime premium = `overtime_hours × (weighted_rate × 0.5)`
   - Agricultural hours exempt from overtime

5. **Total Calculation**:
   - `total_earnings = ag_earnings + non_ag_earnings + overtime_premium`

**Acceptance Criteria Satisfied**:
- REQ-014.1: Calculate pay as hours × task rate (using rate effective on date of work)
- REQ-014.2: Apply agricultural minimum wage floor ($8/hr)
- REQ-014.3: Apply general minimum wage floor ($15/hr)
- REQ-015.1: Calculate weighted-average regular rate
- REQ-015.2: Apply overtime rate of 1.5× weighted average for hours > 40/week
- REQ-015.3: Exempt agricultural work from overtime

---

### Task 2: Integrate Payroll Calculation with Approval Flow

**File to modify**: `packages/backend/src/services/review.service.ts`

**Changes**:

1. Import payroll service
2. After successful status update to `'approved'`:
   - Call `calculatePayrollForTimesheet(timesheetId)`
   - Store resulting `PayrollRecord`
   - Include payroll summary in response (optional)

3. Error handling:
   - If payroll calculation fails, log error but don't block approval
   - Allow manual recalculation via separate endpoint

**Code structure**:
```typescript
async approveTimesheet(timesheetId: string, supervisorId: string, notes?: string) {
  // Existing: Update status to approved
  const timesheet = await this.updateStatus(timesheetId, 'approved', supervisorId, notes);

  // NEW: Calculate payroll
  try {
    const payroll = await payrollService.calculatePayrollForTimesheet(timesheetId);
    return { timesheet, payroll };
  } catch (error) {
    logger.error('Payroll calculation failed', { timesheetId, error });
    return { timesheet, payrollError: 'Calculation pending' };
  }
}
```

---

### Task 3: Payroll API Routes

**File to create**: `packages/backend/src/routes/payroll.ts`

**Endpoints**:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/payroll/timesheet/:timesheetId` | Get payroll record for specific timesheet |
| GET | `/api/payroll/report` | List payroll records with filters |
| POST | `/api/payroll/export` | Generate and download CSV export |
| POST | `/api/payroll/recalculate/:timesheetId` | Recalculate payroll for approved timesheet |

**Query Parameters for `/report`**:
- `startDate` (required): ISO date string
- `endDate` (required): ISO date string
- `employeeId` (optional): Filter by employee

**Request Schema** (using Zod):
```typescript
const payrollReportSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  employeeId: z.string().uuid().optional()
});

const payrollExportSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  employeeId: z.string().uuid().optional()
});
```

**File to create**: `packages/backend/src/routes/payroll.schema.ts`

---

### Task 4: CSV Export Utility

**File to create**: `packages/backend/src/utils/payroll-export.ts`

**Function**:
```typescript
generatePayrollCSV(records: PayrollRecordWithDetails[]): string
```

**CSV Columns**:
| Column | Description |
|--------|-------------|
| Employee Name | Full name |
| Employee ID | Database ID (for reference) |
| Pay Period Start | MM/DD/YYYY format |
| Pay Period End | MM/DD/YYYY format |
| Agricultural Hours | Decimal, 2 places |
| Agricultural Earnings | Decimal, 2 places |
| Non-Agricultural Hours | Decimal, 2 places |
| Non-Agricultural Earnings | Decimal, 2 places |
| Overtime Hours | Decimal, 2 places |
| Overtime Earnings | Decimal, 2 places |
| Total Earnings | Decimal, 2 places |
| Calculated At | ISO timestamp |

**Acceptance Criteria Satisfied**:
- REQ-023.1: Generate payroll export reports in CSV format
- REQ-023.2: Include employee name, pay period, task breakdown, hours, rates, totals, overtime

---

### Task 5: Payroll Report Frontend Component

**File to create**: `packages/frontend/src/components/PayrollReport.tsx`

**Features**:

1. **Filter Controls**:
   - Date range picker (start date, end date)
   - Employee dropdown (optional filter)
   - Apply filters button

2. **Results Table**:
   | Column | Content |
   |--------|---------|
   | Employee | Name (clickable to expand) |
   | Period | Start - End dates |
   | Ag Hours | Agricultural hours worked |
   | Ag Earnings | Agricultural pay |
   | Non-Ag Hours | Non-agricultural hours |
   | Non-Ag Earnings | Non-agricultural pay |
   | OT Hours | Overtime hours |
   | OT Earnings | Overtime premium |
   | Total | Total earnings |

3. **Export Button**:
   - "Download CSV" button
   - Uses current filter parameters
   - Triggers file download

4. **Expandable Row Details**:
   - Task code breakdown per employee
   - Individual entry details

**Required data-testid attributes**:
- `payroll-report-start-date`
- `payroll-report-end-date`
- `payroll-report-employee-filter`
- `payroll-report-apply-filters`
- `payroll-report-table`
- `payroll-report-row-{employeeId}`
- `payroll-report-export-csv`
- `payroll-report-total-earnings`

**Acceptance Criteria Satisfied**:
- REQ-014.5: Generate payroll report per employee per pay period
- REQ-026.1: Reports filterable by date range, employee
- REQ-026.4: Display reports as read-only

---

### Task 6: Payroll Report Page

**File to create**: `packages/frontend/src/pages/PayrollReportPage.tsx`

**Features**:
- Page wrapper for PayrollReport component
- Breadcrumb navigation
- Page title: "Payroll Reports"
- Supervisor-only access (check role)

**File to modify**: `packages/frontend/src/routes.tsx` (or router config)
- Add route: `/supervisor/payroll`

---

### Task 7: Frontend API Client Methods

**File to modify**: `packages/frontend/src/api/client.ts`

**Methods to add**:

```typescript
// Get payroll record for a timesheet
async getPayrollRecord(timesheetId: string): Promise<PayrollRecord>

// Get payroll report with filters
async getPayrollReport(params: {
  startDate: string;
  endDate: string;
  employeeId?: string;
}): Promise<PayrollRecord[]>

// Export payroll as CSV (returns blob for download)
async exportPayrollCSV(params: {
  startDate: string;
  endDate: string;
  employeeId?: string;
}): Promise<Blob>
```

---

### Task 8: Shared Types

**File to modify**: `packages/shared/types.ts` (or create if needed)

**Types to add**:

```typescript
interface PayrollRecord {
  id: string;
  timesheetId: string;
  employeeId: string;
  periodStart: string; // ISO date
  periodEnd: string; // ISO date
  agriculturalHours: string; // Decimal as string
  agriculturalEarnings: string;
  nonAgriculturalHours: string;
  nonAgriculturalEarnings: string;
  overtimeHours: string;
  overtimeEarnings: string;
  totalEarnings: string;
  calculatedAt: string; // ISO timestamp
  exportedAt: string | null;
}

interface PayrollRecordWithDetails extends PayrollRecord {
  employee: {
    id: string;
    name: string;
  };
  timesheet: {
    id: string;
    weekStartDate: string;
  };
}

interface PayrollFilters {
  startDate: string;
  endDate: string;
  employeeId?: string;
}

interface PayrollExportParams {
  startDate: string;
  endDate: string;
  employeeId?: string;
}
```

---

## Tests to Write

### Unit Tests

**File to create**: `packages/backend/src/__tests__/services/payroll.service.test.ts`

**Test Cases**:

1. **Rate Lookup Tests**:
   - Returns correct rate when single rate exists
   - Returns most recent rate when multiple rates exist
   - Uses rate effective on work date, not current date
   - Throws error when no rate found for date

2. **Basic Calculation Tests**:
   - Single task code, single entry: `hours × rate`
   - Multiple entries same task code: sums correctly
   - Multiple task codes: separates agricultural vs non-agricultural

3. **Minimum Wage Floor Tests**:
   - Agricultural rate at exactly $8.00 passes
   - Agricultural rate below $8.00 logs warning
   - Non-agricultural rate at exactly $15.00 passes
   - Non-agricultural rate below $15.00 logs warning

4. **Overtime Calculation Tests**:
   - No overtime when non-ag hours ≤ 40
   - Overtime triggers at 40.01 non-ag hours
   - Weighted average calculated correctly with multiple rates:
     - 20 hrs @ $15 + 25 hrs @ $20 = $675 / 45 hrs = $15/hr weighted
     - 5 hrs OT @ ($15 × 0.5) = $37.50 premium
   - Agricultural hours excluded from overtime calculation
   - Mixed ag/non-ag: only non-ag triggers overtime

5. **Edge Cases**:
   - Zero hours timesheet (should calculate $0)
   - All agricultural hours (no overtime)
   - Exactly 40 non-ag hours (no overtime)
   - 40.5 non-ag hours (0.5 hrs overtime)
   - Rate change mid-week (uses correct rate per day)

6. **Decimal Precision Tests**:
   - No floating point errors on $15.33/hr × 7.5 hrs
   - Rounds to 2 decimal places for final amounts
   - Preserves precision during intermediate calculations

### Integration Tests

**File to create**: `packages/backend/src/__tests__/integration/payroll.integration.test.ts`

**Test Cases**:

1. **Approval Flow**:
   - Approve timesheet → payroll record created
   - Payroll record has correct `timesheetId` reference
   - Payroll record has correct employee reference

2. **API Endpoints**:
   - GET `/api/payroll/timesheet/:id` returns record
   - GET `/api/payroll/report` filters correctly by date range
   - GET `/api/payroll/report` filters correctly by employee
   - POST `/api/payroll/export` returns valid CSV

3. **Error Handling**:
   - 404 when timesheet not found
   - 400 when timesheet not approved
   - Validation errors for invalid date formats

### E2E Tests

**File to create**: `packages/frontend/e2e/payroll-report.spec.ts`

**Test Cases**:

1. **Report Page Access**:
   - Supervisor can access payroll report page
   - Employee cannot access payroll report page (403)

2. **Filtering**:
   - Date range filter shows correct records
   - Employee filter narrows results
   - Empty results show appropriate message

3. **Export**:
   - CSV download triggers on button click
   - Downloaded file has correct headers
   - Downloaded file has correct data

---

## File Summary

### Files to Create

| File | Purpose |
|------|---------|
| `packages/backend/src/services/payroll.service.ts` | Core payroll calculation logic |
| `packages/backend/src/routes/payroll.ts` | API endpoints for payroll |
| `packages/backend/src/routes/payroll.schema.ts` | Zod schemas for validation |
| `packages/backend/src/utils/payroll-export.ts` | CSV generation utility |
| `packages/backend/src/__tests__/services/payroll.service.test.ts` | Unit tests |
| `packages/backend/src/__tests__/integration/payroll.integration.test.ts` | Integration tests |
| `packages/frontend/src/components/PayrollReport.tsx` | Report table component |
| `packages/frontend/src/pages/PayrollReportPage.tsx` | Report page wrapper |
| `packages/frontend/e2e/payroll-report.spec.ts` | E2E tests |

### Files to Modify

| File | Changes |
|------|---------|
| `packages/backend/src/services/review.service.ts` | Trigger payroll on approval |
| `packages/backend/src/routes/index.ts` | Register payroll routes |
| `packages/frontend/src/api/client.ts` | Add payroll API methods |
| `packages/frontend/src/routes.tsx` | Add payroll report route |
| `packages/shared/types.ts` | Add PayrollRecord types |

---

## Acceptance Criteria Checklist

From `requirements.md`:

### REQ-014: Payroll Calculation
- [ ] 14.1: Calculate pay as hours × task rate (using rate effective on date of work)
- [ ] 14.2: Apply agricultural minimum wage floor ($8/hr)
- [ ] 14.3: Apply general minimum wage floor ($15/hr)
- [ ] 14.4: Flag any calculated pay below applicable minimum
- [ ] 14.5: Generate payroll report per employee per pay period

### REQ-015: Weighted Overtime Calculation
- [ ] 15.1: Calculate weighted-average regular rate for multi-rate employees
- [ ] 15.2: Apply overtime rate of 1.5× weighted average for hours > 40/week
- [ ] 15.3: Exempt agricultural work from overtime
- [ ] 15.4: Display warning to supervisor when overtime threshold exceeded

### REQ-023: Payroll Export
- [ ] 23.1: Generate payroll export reports in CSV format
- [ ] 23.2: Include: employee name, pay period, task breakdown, hours, rates, totals, overtime
- [ ] 23.3: Design data model to support future QuickBooks API integration

### REQ-026: Reporting (Payroll-specific)
- [ ] 26.1: Reports filterable by date range, employee
- [ ] 26.3: Calculate costs using rate in effect on date hours were incurred
- [ ] 26.4: Display reports as read-only

---

## Implementation Order

1. **Payroll Service** (Task 1) - Core calculation logic
2. **Unit Tests** - Validate calculation logic
3. **API Routes** (Task 3) - Expose functionality
4. **Integration with Approval** (Task 2) - Trigger on approve
5. **CSV Export** (Task 4) - Export utility
6. **Shared Types** (Task 8) - Frontend types
7. **API Client Methods** (Task 7) - Frontend API
8. **Report Component** (Task 5) - UI component
9. **Report Page** (Task 6) - Page wrapper
10. **E2E Tests** - Full flow validation

---

## Estimated Complexity

| Task | Complexity | Notes |
|------|------------|-------|
| Payroll Service | High | Core business logic, rate versioning, overtime math |
| Unit Tests | Medium | Many edge cases to cover |
| API Routes | Low | Standard CRUD patterns |
| Integration | Low | Small modification to existing code |
| CSV Export | Low | String formatting utility |
| Report Component | Medium | Table with filters, expandable rows |
| E2E Tests | Medium | Multiple user flows |

---

## Risk Areas

1. **Decimal Precision**: Use `Decimal.js` or Drizzle's decimal type, never JavaScript `number` for currency
2. **Rate Versioning Edge Cases**: Rate changes mid-week require per-entry lookup
3. **Overtime Exemption**: Agricultural classification must be accurate at task code level
4. **Performance**: Large date ranges could return many records; consider pagination

---

## Definition of Done

Phase 9 is complete when:

1. [ ] All payroll calculations match expected values in unit tests
2. [ ] Approval of timesheet creates payroll record automatically
3. [ ] Supervisor can view payroll report with filters
4. [ ] CSV export downloads with correct data
5. [ ] Overtime is calculated correctly (weighted average, ag exempt)
6. [ ] Minimum wage floors are validated
7. [ ] All unit tests pass
8. [ ] All integration tests pass
9. [ ] All E2E tests pass
10. [ ] Code reviewed and merged
