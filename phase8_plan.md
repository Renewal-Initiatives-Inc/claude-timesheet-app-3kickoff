# Phase 8: Submission & Review Workflow - Execution Plan

## Overview

**Goal**: Implement the complete submit → review → approve/reject workflow, enabling supervisors to review employee timesheets and approve or reject them while maintaining full audit trail immutability.

**Dependencies from Previous Phases** (all verified complete):
- ✅ Phase 2: Database schema with `timesheets` table status field
- ✅ Phase 3: Authentication with supervisor role checking (`requireSupervisor` middleware)
- ✅ Phase 6: Timesheet entry interface with submit button
- ✅ Phase 7: Compliance rule engine with `ComplianceCheckLogs` table

**Current State**:
- `POST /api/timesheets/:id/submit` exists and changes status to `submitted` after compliance passes
- Status field supports: `open | submitted | approved | rejected`
- Frontend Timesheet page can submit and shows success/error states
- ComplianceCheckLogs table stores all compliance check results

**Missing for Phase 8**:
- Supervisor review queue API endpoint
- Approve/reject endpoints
- Historical week unlocking
- Frontend review queue page
- Frontend review detail page (read-only timesheet view)
- Compliance summary component for supervisors

---

## Task Breakdown

### Task 1: Backend - Supervisor Review Queue Endpoint

**Files to create/modify**:
- `packages/backend/src/routes/supervisor.ts` (new)
- `packages/backend/src/services/review.service.ts` (new)
- `packages/backend/src/app.ts` (register route)
- `packages/shared/types/src/index.ts` (add types)

**Implementation**:

1. Create review service with:
   ```typescript
   // Get all timesheets awaiting review
   getReviewQueue(options?: { employeeId?: string }): Promise<ReviewQueueItem[]>

   // Get single timesheet with full details for review
   getTimesheetForReview(timesheetId: string): Promise<TimesheetReviewData>

   // Get compliance check logs for a timesheet
   getComplianceLogs(timesheetId: string): Promise<ComplianceCheckLog[]>
   ```

2. Create supervisor routes:
   ```
   GET  /api/supervisor/review-queue         - List submitted timesheets
   GET  /api/supervisor/review/:id           - Get timesheet for review (with compliance logs)
   POST /api/supervisor/review/:id/approve   - Approve timesheet
   POST /api/supervisor/review/:id/reject    - Reject timesheet (requires notes)
   ```

**Acceptance Criteria** (from requirements):
- REQ-012.1: Display submitted timesheets in read-only mode ✓
- REQ-012.2: Allow supervisors to add notes ✓
- REQ-012.3: Allow supervisors to Approve or Reject ✓
- REQ-011.6: Log all compliance check results for audit trail ✓

---

### Task 2: Backend - Approve Endpoint

**Files to modify**:
- `packages/backend/src/services/review.service.ts`
- `packages/backend/src/routes/supervisor.ts`
- `packages/backend/src/validation/supervisor.schema.ts` (new)

**Implementation**:

1. Approve endpoint logic:
   - Validate timesheet status is `submitted`
   - Update status to `approved`
   - Set `reviewedBy` to supervisor ID
   - Set `reviewedAt` to current timestamp
   - Optionally add supervisor notes
   - **Note**: Payroll calculation (Phase 9) will be triggered here later

2. Request/response schema:
   ```typescript
   // Request (optional)
   { notes?: string }

   // Response
   {
     success: true,
     timesheet: Timesheet,
     message: "Timesheet approved successfully"
   }
   ```

**Acceptance Criteria**:
- REQ-012.3: Approve transitions to approved status ✓
- REQ-012.6: Move approved timesheets to payroll queue ✓ (placeholder for Phase 9)

---

### Task 3: Backend - Reject Endpoint

**Files to modify**:
- `packages/backend/src/services/review.service.ts`
- `packages/backend/src/routes/supervisor.ts`

**Implementation**:

1. Reject endpoint logic:
   - Validate timesheet status is `submitted`
   - **Require** supervisor notes (minimum 10 characters)
   - Update status back to `open`
   - Set `reviewedBy` to supervisor ID
   - Set `reviewedAt` to current timestamp
   - Store `supervisorNotes`

2. Request/response schema:
   ```typescript
   // Request (required)
   { notes: string }  // min 10 chars

   // Response
   {
     success: true,
     timesheet: Timesheet,
     message: "Timesheet returned to employee for revision"
   }
   ```

**Acceptance Criteria**:
- REQ-012.3: Reject returns timesheet to Open status ✓
- REQ-012.5: Notes visible to employee on rejected timesheets ✓

---

### Task 4: Backend - Historical Week Unlocking

**Files to modify**:
- `packages/backend/src/services/review.service.ts`
- `packages/backend/src/routes/supervisor.ts`

**Implementation**:

1. Add endpoint:
   ```
   POST /api/supervisor/unlock-week
   Body: { employeeId: string, weekStartDate: string }
   ```

2. Logic:
   - Create new timesheet with status `open` if none exists
   - Or change existing `approved`/`rejected` timesheet back to `open`
   - Log unlock action for audit

**Acceptance Criteria**:
- REQ-019.5: Allow supervisors to unlock specific past weeks ✓

---

### Task 5: Backend - Enforce Immutability

**Files to modify**:
- `packages/backend/src/routes/timesheets.ts` (existing)
- `packages/backend/src/services/timesheet-entry.service.ts` (verify)

**Implementation**:

1. Verify existing immutability checks in entry routes:
   - `POST /:id/entries` - already blocks if not editable
   - `PATCH /:id/entries/:entryId` - already blocks if not editable
   - `DELETE /:id/entries/:entryId` - already blocks if not editable

2. Strengthen `isTimesheetEditable()` check:
   - Currently only allows editing when `status === 'open'`
   - Add explicit error message: "Cannot modify timesheet with status: {status}"

3. Add protection against re-submission:
   - Already exists: `if (timesheet.status !== 'open')` check in submit endpoint

**Acceptance Criteria**:
- REQ-012.4: Cannot edit hours, task codes, dates after submission ✓
- P6 (design.md): Supervisor actions limited to add note, approve, reject ✓

---

### Task 6: Frontend - Review Queue Page

**Files to create**:
- `packages/frontend/src/pages/ReviewQueue.tsx`
- `packages/frontend/src/pages/ReviewQueue.css`
- `packages/frontend/src/hooks/useReviewQueue.ts`
- `packages/frontend/src/api/supervisor.ts`

**Implementation**:

1. API client functions:
   ```typescript
   getReviewQueue(): Promise<ReviewQueueItem[]>
   getTimesheetForReview(id: string): Promise<TimesheetReviewData>
   approveTimesheet(id: string, notes?: string): Promise<ApproveResponse>
   rejectTimesheet(id: string, notes: string): Promise<RejectResponse>
   ```

2. ReviewQueue page:
   - Table of submitted timesheets
   - Columns: Employee Name, Week, Submitted At, Total Hours, Actions
   - Click row to go to review detail
   - Badge showing count of pending reviews
   - Filter by employee (optional)

3. Required test IDs:
   ```
   data-testid="review-queue-table"
   data-testid="review-queue-row-{id}"
   data-testid="review-queue-view-button"
   data-testid="review-queue-empty-state"
   ```

**Acceptance Criteria**:
- REQ-012.1: Display submitted timesheets in queue ✓
- REQ-025.3: Show count of pending review items ✓

---

### Task 7: Frontend - Review Detail Page

**Files to create**:
- `packages/frontend/src/pages/ReviewDetail.tsx`
- `packages/frontend/src/pages/ReviewDetail.css`
- `packages/frontend/src/components/ComplianceSummary.tsx`
- `packages/frontend/src/components/ReviewActions.tsx`

**Implementation**:

1. ReviewDetail page:
   - Read-only timesheet display (reuse TimesheetGrid with `disabled={true}`)
   - Employee information header
   - Compliance summary section
   - Notes textarea
   - Approve/Reject buttons

2. ComplianceSummary component:
   - Display compliance check results from submission
   - Show: Total rules, Passed, N/A
   - Expandable list of all checks

3. ReviewActions component:
   - Notes input (optional for approve, required for reject)
   - Approve button (primary)
   - Reject button (danger)
   - Confirmation modal for reject

4. Required test IDs:
   ```
   data-testid="review-detail-page"
   data-testid="review-employee-info"
   data-testid="compliance-summary"
   data-testid="field-supervisorNotes"
   data-testid="review-approve-button"
   data-testid="review-reject-button"
   data-testid="reject-confirm-modal"
   ```

**Acceptance Criteria**:
- REQ-012.1: Display in read-only mode ✓
- REQ-012.2: Allow adding notes ✓
- REQ-012.4: Cannot edit employee data ✓

---

### Task 8: Frontend - Routing and Navigation

**Files to modify**:
- `packages/frontend/src/App.tsx`
- `packages/frontend/src/components/AppLayout.tsx` (add nav link)
- `packages/frontend/src/pages/Dashboard.tsx` (add pending count)

**Implementation**:

1. Add routes:
   ```tsx
   <Route path="/review" element={<ReviewQueue />} />
   <Route path="/review/:timesheetId" element={<ReviewDetail />} />
   ```

2. Add navigation:
   - "Review Queue" link in supervisor nav (with badge count)
   - Link from Dashboard stats to review queue

3. Dashboard enhancement:
   - Show pending review count in stats card
   - Click to navigate to review queue

**Acceptance Criteria**:
- REQ-025.3: Show count of pending review items on login ✓

---

### Task 9: Frontend - Employee Rejection Notification Display

**Files to modify**:
- `packages/frontend/src/pages/Timesheet.tsx` (already partially implemented)

**Implementation**:

1. Verify existing implementation:
   - Status alert already shows rejection message
   - Supervisor notes already displayed

2. Enhance if needed:
   - Make rejection more prominent
   - Add clear call-to-action to edit and resubmit
   - Show when timesheet was reviewed and by whom

**Acceptance Criteria**:
- REQ-012.5: Notes visible to employee on rejection ✓

---

### Task 10: Shared Types

**Files to modify**:
- `packages/shared/types/src/index.ts`

**Implementation**:

Add types:
```typescript
// Review queue item (summary for list view)
export interface ReviewQueueItem {
  id: string;
  employeeId: string;
  employeeName: string;
  weekStartDate: string;
  submittedAt: string;
  totalHours: number;
  entryCount: number;
}

// Full timesheet data for review
export interface TimesheetReviewData {
  timesheet: TimesheetWithEntries;
  employee: EmployeePublic;
  complianceLogs: ComplianceCheckLog[];
}

// Compliance log entry
export interface ComplianceCheckLog {
  id: string;
  timesheetId: string;
  ruleId: string;
  result: 'pass' | 'fail' | 'not_applicable';
  details: {
    ruleDescription: string;
    checkedValues?: Record<string, unknown>;
    threshold?: number | string;
    actualValue?: number | string;
    message?: string;
  };
  checkedAt: string;
  employeeAgeOnDate: number;
}

// API responses
export interface ApproveTimesheetResponse {
  success: boolean;
  timesheet: Timesheet;
  message: string;
}

export interface RejectTimesheetResponse {
  success: boolean;
  timesheet: Timesheet;
  message: string;
}
```

---

### Task 11: Unit Tests - Backend

**Files to create**:
- `packages/backend/src/services/__tests__/review.service.test.ts`
- `packages/backend/src/routes/__tests__/supervisor.test.ts`

**Test cases**:

1. Review service tests:
   - `getReviewQueue` returns only submitted timesheets
   - `getReviewQueue` includes employee name and totals
   - `getTimesheetForReview` includes compliance logs
   - `approveTimesheet` changes status and sets reviewer info
   - `approveTimesheet` fails if not submitted status
   - `rejectTimesheet` returns to open status with notes
   - `rejectTimesheet` requires minimum 10 character notes
   - `rejectTimesheet` fails if not submitted status

2. Route tests:
   - 401 for unauthenticated requests
   - 403 for non-supervisor requests
   - Proper validation of request bodies
   - Correct status codes and response shapes

---

### Task 12: Unit Tests - Frontend

**Files to create**:
- `packages/frontend/src/pages/__tests__/ReviewQueue.test.tsx`
- `packages/frontend/src/pages/__tests__/ReviewDetail.test.tsx`
- `packages/frontend/src/components/__tests__/ComplianceSummary.test.tsx`
- `packages/frontend/src/components/__tests__/ReviewActions.test.tsx`

**Test cases**:

1. ReviewQueue:
   - Renders loading state
   - Renders empty state when no timesheets
   - Renders list of submitted timesheets
   - Click navigates to review detail

2. ReviewDetail:
   - Displays timesheet in read-only mode
   - Shows compliance summary
   - Approve button calls API and navigates back
   - Reject button shows confirmation modal
   - Reject requires notes

3. ComplianceSummary:
   - Displays passed/failed/N/A counts
   - Expands to show rule details

---

### Task 13: E2E Tests

**Files to create/modify**:
- `e2e/review-workflow.spec.ts` (new)

**Test scenarios**:

1. **Full approval flow**:
   - Employee submits timesheet
   - Supervisor sees timesheet in review queue
   - Supervisor opens review detail
   - Supervisor approves
   - Timesheet status changes to approved
   - Employee sees approved status

2. **Full rejection flow**:
   - Employee submits timesheet
   - Supervisor rejects with notes
   - Employee sees rejected status with notes
   - Employee edits and resubmits
   - Supervisor approves second submission

3. **Immutability verification**:
   - Employee submits timesheet
   - Employee cannot add/edit/delete entries on submitted timesheet
   - After approval, still cannot edit

4. **Historical week unlocking**:
   - Supervisor unlocks past week for employee
   - Employee can now enter time for that week

---

## File Summary

### New Files (16)
| File | Purpose |
|------|---------|
| `packages/backend/src/routes/supervisor.ts` | Supervisor review API routes |
| `packages/backend/src/services/review.service.ts` | Review business logic |
| `packages/backend/src/validation/supervisor.schema.ts` | Zod validation schemas |
| `packages/backend/src/services/__tests__/review.service.test.ts` | Service unit tests |
| `packages/backend/src/routes/__tests__/supervisor.test.ts` | Route unit tests |
| `packages/frontend/src/pages/ReviewQueue.tsx` | Review queue page |
| `packages/frontend/src/pages/ReviewQueue.css` | Review queue styles |
| `packages/frontend/src/pages/ReviewDetail.tsx` | Review detail page |
| `packages/frontend/src/pages/ReviewDetail.css` | Review detail styles |
| `packages/frontend/src/components/ComplianceSummary.tsx` | Compliance log display |
| `packages/frontend/src/components/ReviewActions.tsx` | Approve/reject buttons |
| `packages/frontend/src/hooks/useReviewQueue.ts` | Review queue data hook |
| `packages/frontend/src/api/supervisor.ts` | Supervisor API client |
| `packages/frontend/src/pages/__tests__/ReviewQueue.test.tsx` | Queue page tests |
| `packages/frontend/src/pages/__tests__/ReviewDetail.test.tsx` | Detail page tests |
| `e2e/review-workflow.spec.ts` | E2E workflow tests |

### Modified Files (5)
| File | Changes |
|------|---------|
| `packages/backend/src/app.ts` | Register supervisor routes |
| `packages/frontend/src/App.tsx` | Add review routes |
| `packages/frontend/src/components/AppLayout.tsx` | Add review queue nav link |
| `packages/frontend/src/pages/Dashboard.tsx` | Add pending review count |
| `packages/shared/types/src/index.ts` | Add review types |

---

## Requirements Satisfaction

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| REQ-011.6 | ✅ | Compliance logs already stored (Phase 7) |
| REQ-012.1 | ✅ | Read-only timesheet display in ReviewDetail |
| REQ-012.2 | ✅ | Notes field in review actions |
| REQ-012.3 | ✅ | Approve/Reject endpoints |
| REQ-012.4 | ✅ | TimesheetGrid disabled prop + backend validation |
| REQ-012.5 | ✅ | Rejection notes shown in Timesheet page |
| REQ-012.6 | ✅ | Approval triggers payroll queue (placeholder) |
| REQ-019.4 | ✅ | Past weeks locked by default |
| REQ-019.5 | ✅ | Supervisor unlock endpoint |
| REQ-025.3 | ✅ | Pending count on dashboard/nav |

---

## Design Principles Verified

| Principle | Enforcement |
|-----------|-------------|
| P6: Supervisor Immutability | Backend rejects edits to non-open timesheets |
| P8: Audit Completeness | All compliance checks logged with timestamps |
| Fail closed | Reject requires notes; unknown status = blocked |
| Guide, don't just block | Rejection notes explain what to fix |

---

## Estimated Effort

| Task | Complexity | Effort |
|------|------------|--------|
| Task 1: Review queue endpoint | Medium | ⬛⬛⬜ |
| Task 2: Approve endpoint | Low | ⬛⬜⬜ |
| Task 3: Reject endpoint | Low | ⬛⬜⬜ |
| Task 4: Week unlocking | Low | ⬛⬜⬜ |
| Task 5: Immutability verification | Low | ⬛⬜⬜ |
| Task 6: ReviewQueue page | Medium | ⬛⬛⬜ |
| Task 7: ReviewDetail page | Medium | ⬛⬛⬜ |
| Task 8: Routing/navigation | Low | ⬛⬜⬜ |
| Task 9: Employee rejection display | Low | ⬛⬜⬜ |
| Task 10: Shared types | Low | ⬛⬜⬜ |
| Task 11: Backend tests | Medium | ⬛⬛⬜ |
| Task 12: Frontend tests | Medium | ⬛⬛⬜ |
| Task 13: E2E tests | Medium | ⬛⬛⬜ |

---

## Success Criteria

Before marking Phase 8 complete, verify:

- [ ] Supervisors can see all submitted timesheets in review queue
- [ ] Supervisors can view timesheet details in read-only mode
- [ ] Supervisors can see compliance check summary
- [ ] Approve button changes status to `approved`
- [ ] Reject button requires notes and returns to `open`
- [ ] Employees see rejection notes on their timesheet
- [ ] Employees cannot edit submitted/approved timesheets
- [ ] Supervisors can unlock past weeks for employees
- [ ] Pending review count appears on dashboard/nav
- [ ] All unit tests pass
- [ ] E2E workflow tests pass

---

## Next Phase Preview

**Phase 9: Payroll Calculation & Export** will:
- Calculate pay on timesheet approval
- Implement weighted-average overtime
- Create PayrollRecord entries
- Generate CSV export

The approve endpoint in Phase 8 will be extended to trigger payroll calculation in Phase 9.
