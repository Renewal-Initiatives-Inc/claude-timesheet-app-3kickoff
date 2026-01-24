# Phase 11: Reporting & Audit - Execution Plan

## Overview

**Goal**: Provide visibility into operations and compliance history with comprehensive reporting capabilities.

**Dependencies Verified**:
- ✅ Phase 7 (Compliance Engine): `complianceCheckLogs` table stores all compliance check results
- ✅ Phase 8 (Submission Workflow): Timesheets have status tracking (open/submitted/approved/rejected)
- ✅ Phase 9 (Payroll): PayrollReportPage and `/api/payroll/report` already exist with filtering
- ✅ Phase 10 (Alerts): Alert notification logging exists

---

## Requirements Addressed

| Requirement | Criteria | Implementation |
|-------------|----------|----------------|
| REQ-026.1 | Reports filterable by date range, employee, task code, age band | Reports Dashboard + filter components |
| REQ-026.2 | Include compliance indicators (warnings, blocks, rejections) | Compliance Audit Report |
| REQ-026.3 | Calculate costs using rate effective on date of work | Already implemented in payroll service |
| REQ-026.4 | Display reports as read-only (no modification) | No edit controls in report UI |
| REQ-022.1 | Retain timesheets for minimum 3 years | Verification tests |
| REQ-022.2 | Retain compliance check logs for minimum 3 years | Verification tests |
| REQ-022.3 | Retain uploaded documents for minimum 3 years | Verification tests |
| REQ-022.4 | NOT automatically delete timesheet/employee data | Audit of delete operations |

---

## Task Breakdown

### Task 1: Reports Dashboard Page

Create a landing page for all reporting functionality, providing navigation to specific reports.

**Files to create**:
- `packages/frontend/src/pages/ReportsDashboard.tsx`

**Implementation details**:
- Cards linking to each report type:
  - Payroll Report (existing)
  - Compliance Audit Report (new)
  - Timesheet History Report (new)
- Quick stats summary (pending reviews, recent rejections, active employees)
- Supervisor-only access (requireSupervisor check)

**Data-testid requirements**:
- `reports-dashboard-payroll-card`
- `reports-dashboard-compliance-card`
- `reports-dashboard-timesheet-card`

---

### Task 2: Compliance Audit Report Backend

Create API endpoint to query compliance check history with filtering.

**Files to create**:
- `packages/backend/src/routes/reports.ts`
- `packages/backend/src/services/reports.service.ts`
- `packages/backend/src/validation/reports.schema.ts`

**API Endpoint**: `GET /api/reports/compliance-audit`

**Query Parameters**:
```typescript
{
  startDate: string;        // Required, YYYY-MM-DD
  endDate: string;          // Required, YYYY-MM-DD
  employeeId?: string;      // Optional filter
  ageBand?: '12-13' | '14-15' | '16-17' | '18+'; // Optional filter
  result?: 'pass' | 'fail' | 'not_applicable';   // Optional filter
  ruleId?: string;          // Optional, e.g., "RULE-002"
}
```

**Response**:
```typescript
{
  records: ComplianceAuditRecord[];
  summary: {
    totalChecks: number;
    passCount: number;
    failCount: number;
    notApplicableCount: number;
    uniqueTimesheets: number;
    uniqueEmployees: number;
    ruleBreakdown: { ruleId: string; passCount: number; failCount: number }[];
  };
}
```

**Implementation details**:
- Join `complianceCheckLogs` with `timesheets` and `employees`
- Filter by `checkedAt` date range
- Use existing `getAgeBand()` utility for age band filtering
- Group by rule for breakdown summary
- Order by `checkedAt` descending

---

### Task 3: Compliance Audit Report Frontend

Create UI for viewing compliance audit history.

**Files to create**:
- `packages/frontend/src/pages/ComplianceAuditReport.tsx`
- `packages/frontend/src/api/reports.ts` (or extend existing client.ts)

**UI Components**:
- Date range picker (startDate, endDate)
- Employee dropdown filter
- Age band dropdown filter (12-13, 14-15, 16-17, 18+)
- Result filter (All, Pass, Fail)
- Rule ID filter (optional)
- Summary cards (total checks, pass %, fail count)
- Results table:
  - Timestamp
  - Employee name
  - Age on date
  - Rule ID
  - Result (color-coded: green/red/gray)
  - Details (expandable)
  - Link to timesheet

**Data-testid requirements**:
- `compliance-audit-start-date`
- `compliance-audit-end-date`
- `compliance-audit-employee-filter`
- `compliance-audit-age-band-filter`
- `compliance-audit-result-filter`
- `compliance-audit-search-button`
- `compliance-audit-results-table`
- `compliance-audit-summary-total`
- `compliance-audit-summary-pass`
- `compliance-audit-summary-fail`

---

### Task 4: Timesheet History Report Backend

Create API endpoint for historical timesheet queries with status tracking.

**Files to modify**:
- `packages/backend/src/routes/reports.ts` (add endpoint)
- `packages/backend/src/services/reports.service.ts` (add service method)

**API Endpoint**: `GET /api/reports/timesheet-history`

**Query Parameters**:
```typescript
{
  startDate: string;        // Required, YYYY-MM-DD (week_start_date range)
  endDate: string;          // Required, YYYY-MM-DD
  employeeId?: string;      // Optional filter
  status?: 'open' | 'submitted' | 'approved' | 'rejected'; // Optional
  ageBand?: '12-13' | '14-15' | '16-17' | '18+'; // Optional
}
```

**Response**:
```typescript
{
  timesheets: TimesheetHistoryRecord[];
  summary: {
    totalTimesheets: number;
    statusBreakdown: { status: string; count: number }[];
    totalHours: number;
    totalEarnings: number;  // From payroll records for approved
    employeeBreakdown: { employeeId: string; name: string; count: number }[];
  };
}

interface TimesheetHistoryRecord {
  id: string;
  employeeName: string;
  weekStartDate: string;
  status: string;
  totalHours: number;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  supervisorNotes: string | null;
  complianceCheckCount: number;
  complianceFailCount: number;
}
```

**Implementation details**:
- Join `timesheets` with `employees`, `timesheetEntries`, `payrollRecords`
- Calculate total hours from entries
- Count compliance checks from `complianceCheckLogs`
- Include rejection notes for visibility

---

### Task 5: Timesheet History Report Frontend

Create UI for viewing historical timesheets.

**Files to create**:
- `packages/frontend/src/pages/TimesheetHistoryReport.tsx`

**UI Components**:
- Date range picker for period selection
- Employee dropdown filter
- Status dropdown filter (All, Open, Submitted, Approved, Rejected)
- Age band dropdown filter
- Summary cards (total, approved, rejected, pending)
- Results table:
  - Week (MM/DD - MM/DD)
  - Employee name
  - Status (color-coded badge)
  - Total hours
  - Earnings (if approved)
  - Compliance issues (count, expandable)
  - Supervisor notes (if rejected)
  - View link

**Data-testid requirements**:
- `timesheet-history-start-date`
- `timesheet-history-end-date`
- `timesheet-history-employee-filter`
- `timesheet-history-status-filter`
- `timesheet-history-age-band-filter`
- `timesheet-history-search-button`
- `timesheet-history-results-table`
- `timesheet-history-summary-total`
- `timesheet-history-summary-approved`
- `timesheet-history-summary-rejected`

---

### Task 6: Age Band Filter for Payroll Report

Extend existing PayrollReportPage with age band filtering.

**Files to modify**:
- `packages/frontend/src/pages/PayrollReportPage.tsx`
- `packages/backend/src/routes/payroll.ts`
- `packages/backend/src/services/payroll.service.ts`
- `packages/backend/src/validation/payroll.schema.ts`

**Changes**:
- Add `ageBand` query parameter to `/api/payroll/report`
- Filter payroll records by employee age band (calculate from DOB vs period dates)
- Add age band dropdown to PayrollReportPage UI

**Data-testid requirements**:
- `payroll-report-age-band-filter`

---

### Task 7: CSV Export for Compliance Audit Report

Add export capability to compliance audit report.

**Files to modify**:
- `packages/backend/src/routes/reports.ts`
- `packages/backend/src/utils/compliance-export.ts` (create)

**API Endpoint**: `POST /api/reports/compliance-audit/export`

**Request body**: Same filters as GET endpoint

**Response**: CSV file download

**CSV Columns**:
- Timestamp
- Employee Name
- Employee ID
- Age On Date
- Rule ID
- Rule Description
- Result
- Details (JSON string)
- Timesheet Week Start

---

### Task 8: Navigation and Routing Updates

Add reports routes to application router.

**Files to modify**:
- `packages/frontend/src/App.tsx` (or router config)
- `packages/frontend/src/components/Navigation.tsx` (if exists)

**Routes to add**:
- `/reports` → ReportsDashboard
- `/reports/compliance-audit` → ComplianceAuditReport
- `/reports/timesheet-history` → TimesheetHistoryReport
- Existing: `/reports/payroll` → PayrollReportPage (may need to move)

---

### Task 9: 3-Year Data Accessibility Verification Tests

Create integration tests to verify data retention capabilities.

**Files to create**:
- `packages/backend/src/__tests__/retention.test.ts`

**Test scenarios**:
1. **Timesheet retention**: Create timesheet with timestamp 3 years ago, verify queryable
2. **Compliance log retention**: Create compliance logs dated 3 years ago, verify queryable
3. **Document retention**: Verify document records from 3 years ago are accessible
4. **No cascade delete**: Verify employee archival doesn't cascade delete timesheets
5. **Report queries**: Verify reports can filter to 3+ year old data
6. **Historical rate lookup**: Verify rate effective date queries work for old dates

**Implementation approach**:
- Use Vitest with test database
- Manually insert records with old timestamps for testing
- Verify queries return expected data

---

### Task 10: Unit Tests for Report Services

Create unit tests for report calculation and filtering logic.

**Files to create**:
- `packages/backend/src/services/__tests__/reports.service.test.ts`

**Test scenarios**:
1. **Compliance summary aggregation**: Verify pass/fail/N/A counts
2. **Rule breakdown calculation**: Verify per-rule aggregation
3. **Date range filtering**: Verify boundary conditions (inclusive)
4. **Age band filtering**: Verify age calculation per date
5. **Empty result handling**: Verify graceful handling of no matches
6. **Employee filter**: Verify single-employee filtering
7. **Combined filters**: Verify multiple filters applied together

---

### Task 11: E2E Tests for Report Flows

Create Playwright tests for supervisor report workflows.

**Files to create**:
- `e2e/reports.spec.ts`

**Test scenarios**:
1. **Reports dashboard navigation**: Supervisor can access and navigate reports
2. **Compliance audit report**: Filter by date range, view results, export CSV
3. **Timesheet history report**: Filter by status, view rejected notes
4. **Payroll report age band**: Filter by age band, verify totals
5. **Read-only verification**: Verify no edit controls on reports
6. **Date range validation**: Verify start date must be before end date

---

## File Summary

### New Files to Create

| File | Purpose |
|------|---------|
| `packages/frontend/src/pages/ReportsDashboard.tsx` | Reports landing page |
| `packages/frontend/src/pages/ComplianceAuditReport.tsx` | Compliance check history |
| `packages/frontend/src/pages/TimesheetHistoryReport.tsx` | Timesheet status history |
| `packages/backend/src/routes/reports.ts` | Report API endpoints |
| `packages/backend/src/services/reports.service.ts` | Report business logic |
| `packages/backend/src/validation/reports.schema.ts` | Request validation schemas |
| `packages/backend/src/utils/compliance-export.ts` | CSV export for compliance |
| `packages/frontend/src/api/reports.ts` | Frontend API client for reports |
| `packages/backend/src/__tests__/retention.test.ts` | Data retention tests |
| `packages/backend/src/services/__tests__/reports.service.test.ts` | Service unit tests |
| `e2e/reports.spec.ts` | End-to-end report tests |

### Files to Modify

| File | Changes |
|------|---------|
| `packages/frontend/src/App.tsx` | Add report routes |
| `packages/frontend/src/pages/PayrollReportPage.tsx` | Add age band filter |
| `packages/backend/src/routes/payroll.ts` | Add ageBand parameter |
| `packages/backend/src/services/payroll.service.ts` | Filter by age band |
| `packages/backend/src/validation/payroll.schema.ts` | Add ageBand to schema |
| `packages/backend/src/routes/index.ts` | Register reports router |

---

## Execution Order

1. **Task 2**: Compliance Audit Report Backend (foundation for UI)
2. **Task 4**: Timesheet History Report Backend (foundation for UI)
3. **Task 7**: CSV Export utility (needed by UI)
4. **Task 3**: Compliance Audit Report Frontend
5. **Task 5**: Timesheet History Report Frontend
6. **Task 1**: Reports Dashboard Page (links to new pages)
7. **Task 8**: Navigation and Routing Updates
8. **Task 6**: Age Band Filter for Payroll Report
9. **Task 10**: Unit Tests for Report Services
10. **Task 9**: 3-Year Data Accessibility Tests
11. **Task 11**: E2E Tests for Report Flows

---

## Acceptance Criteria Checklist

Before marking Phase 11 complete:

- [ ] Reports Dashboard accessible to supervisors
- [ ] Compliance Audit Report shows all check history with filters
- [ ] Compliance Audit Report exports to CSV
- [ ] Timesheet History Report shows status breakdown
- [ ] Timesheet History Report shows rejection notes
- [ ] All reports filterable by date range
- [ ] All reports filterable by employee
- [ ] Reports filterable by age band (12-13, 14-15, 16-17, 18+)
- [ ] Compliance report filterable by rule and result
- [ ] Reports display compliance indicators (pass/fail counts, rejection status)
- [ ] Reports use historical rates (already verified in payroll)
- [ ] Reports are read-only (no edit buttons or forms)
- [ ] 3-year-old data accessible in all reports
- [ ] No automatic deletion of timesheet/compliance data
- [ ] Unit tests pass for report calculations
- [ ] E2E tests pass for report workflows

---

## Dependencies to Verify Before Starting

Run these checks before beginning implementation:

```bash
# 1. Verify complianceCheckLogs table has data
# Query: SELECT COUNT(*) FROM compliance_check_logs;

# 2. Verify payroll service rate lookup works
# Test: getEffectiveRateForDate() with historical date

# 3. Verify age utility functions work
# Test: getAgeBand() returns correct bands

# 4. Verify existing PayrollReportPage works
# Navigate to /reports/payroll and test filters
```

---

## Notes

- The existing PayrollReportPage already satisfies REQ-026.3 (rate effective on date of work)
- ComplianceCheckLog already stores `employeeAgeOnDate` for historical accuracy
- Focus on read-only display - no edit operations in any report UI
- Use consistent filtering patterns across all reports
- Follow established patterns from PayrollReportPage for consistency
