# Phase 4: Employee & Document Management - Execution Plan

## Overview

**Goal**: Enable supervisor management of employees and required documentation.

**Dependencies on Previous Phases**:
- ✅ Phase 1: Monorepo structure, TypeScript, Express, React, Vitest, Playwright
- ✅ Phase 2: Database schema with `employees`, `employee_documents` tables
- ✅ Phase 3: Authentication system with JWT, sessions, password reset, middleware

**Key Requirements Addressed**:
- REQ-001: Employee Onboarding
- REQ-002: Minor Documentation Verification
- REQ-003: Safety Training Verification
- REQ-027: User Profile Management
- REQ-028: Revoke Parental Consent

---

## Pre-Implementation Verification

Before starting, verify these Phase 3 components are working:

1. [ ] `requireAuth` and `requireSupervisor` middleware functional
2. [ ] Employee registration creates database records
3. [ ] Age calculation utility works correctly (`/packages/backend/src/utils/age.ts`)
4. [ ] Email service sends welcome emails (`/packages/backend/src/services/email.service.ts`)
5. [ ] Shared types are published and accessible (`@renewal/types`)

---

## Task Breakdown

### Task 4.1: Employee CRUD API Endpoints

**Description**: Create API endpoints for employee management beyond registration.

**Files to Create**:
- `/packages/backend/src/routes/employees.ts` - Employee routes
- `/packages/backend/src/services/employee.service.ts` - Business logic
- `/packages/backend/src/validation/employee.schema.ts` - Zod schemas

**Files to Modify**:
- `/packages/backend/src/app.ts` - Mount employee routes
- `/shared/types/src/api.ts` - Add employee API types

**Endpoints**:

| Method | Path | Auth | Role | Purpose |
|--------|------|------|------|---------|
| GET | `/api/employees` | requireAuth | supervisor | List all employees |
| GET | `/api/employees/:id` | requireAuth | supervisor | Get single employee |
| PATCH | `/api/employees/:id` | requireAuth | supervisor | Update employee |
| DELETE | `/api/employees/:id` | requireAuth | supervisor | Archive employee |
| GET | `/api/employees/:id/documents` | requireAuth | supervisor | List employee documents |
| GET | `/api/employees/:id/documentation-status` | requireAuth | any | Get documentation compliance status |

**Implementation Details**:

```typescript
// GET /api/employees - List all employees
// Query params: status (active/archived/all), search (name/email)
// Returns: { employees: EmployeeWithDocStatus[] }

// GET /api/employees/:id - Get single employee with documents
// Returns: { employee: EmployeeWithDocStatus, documents: EmployeeDocument[] }

// PATCH /api/employees/:id - Update employee
// Body: { name?, email?, dateOfBirth? }
// Note: Cannot change isSupervisor after creation
// Validates: age >= 12 if changing dateOfBirth
// Returns: { employee: EmployeePublic }

// DELETE /api/employees/:id - Archive employee (soft delete)
// Sets status to 'archived'
// Returns: { message: string }
```

**Acceptance Criteria**:
- [ ] Supervisors can list all employees with documentation status
- [ ] Supervisors can view individual employee details
- [ ] Supervisors can update employee name, email (not dateOfBirth without re-validation)
- [ ] Archiving sets status to 'archived' (no hard delete)
- [ ] Non-supervisors cannot access employee management endpoints

---

### Task 4.2: Age Validation on Employee Creation/Update

**Description**: Enforce minimum age requirement and determine required documents.

**Files to Modify**:
- `/packages/backend/src/services/auth.service.ts` - Add age validation to register
- `/packages/backend/src/services/employee.service.ts` - Age validation on update

**Business Rules**:

```typescript
// Age validation rules (from requirements):
// - Reject if age < 12 (REQ-001.3)
// - Ages 12-13: Require parental consent (with COPPA)
// - Ages 14-17: Require parental consent + work permit
// - Ages 18+: No documentation required

interface RequiredDocuments {
  parentalConsent: boolean;
  workPermit: boolean;
  safetyTraining: boolean;
  coppaDisclosure: boolean; // Flag within parental consent for <13
}

function getRequiredDocuments(age: number): RequiredDocuments {
  if (age < 12) throw new Error('Minimum employment age is 12');
  if (age <= 13) return { parentalConsent: true, workPermit: false, safetyTraining: true, coppaDisclosure: true };
  if (age <= 17) return { parentalConsent: true, workPermit: true, safetyTraining: true, coppaDisclosure: false };
  return { parentalConsent: false, workPermit: false, safetyTraining: false, coppaDisclosure: false };
}
```

**Acceptance Criteria**:
- [ ] Registration rejects age < 12 with clear error message
- [ ] System correctly identifies required documents by age
- [ ] COPPA flag included for ages 12-13
- [ ] Age calculated as of current date for new employees

---

### Task 4.3: Document Upload API with Vercel Blob

**Description**: Implement secure file upload for consent forms and work permits.

**Files to Create**:
- `/packages/backend/src/routes/documents.ts` - Document routes
- `/packages/backend/src/services/document.service.ts` - Document business logic
- `/packages/backend/src/services/storage.service.ts` - Vercel Blob integration
- `/packages/backend/src/validation/document.schema.ts` - Zod schemas

**Files to Modify**:
- `/packages/backend/src/app.ts` - Mount document routes
- `/packages/backend/package.json` - Add `@vercel/blob` dependency
- `/shared/types/src/api.ts` - Add document API types
- `/packages/backend/src/config/env.ts` - Add BLOB_READ_WRITE_TOKEN

**Endpoints**:

| Method | Path | Auth | Role | Purpose |
|--------|------|------|------|---------|
| POST | `/api/employees/:id/documents` | requireAuth | supervisor | Upload document |
| GET | `/api/documents/:id` | requireAuth | supervisor | Get document details |
| GET | `/api/documents/:id/download` | requireAuth | supervisor | Get signed download URL |
| DELETE | `/api/documents/:id` | requireAuth | supervisor | Invalidate document |

**Implementation Details**:

```typescript
// POST /api/employees/:id/documents
// Content-Type: multipart/form-data
// Body: { file: File, type: DocumentType, expiresAt?: string (for work permits) }
//
// Process:
// 1. Validate file type (PDF, PNG, JPG)
// 2. Validate file size (max 10MB)
// 3. Upload to Vercel Blob with path: documents/{employeeId}/{type}/{timestamp}-{filename}
// 4. Create employee_documents record
// 5. Return document metadata

// Storage service using Vercel Blob
import { put, del } from '@vercel/blob';

async function uploadDocument(file: Buffer, filename: string, employeeId: string): Promise<string> {
  const blob = await put(`documents/${employeeId}/${filename}`, file, {
    access: 'private',
    addRandomSuffix: true,
  });
  return blob.url;
}
```

**Environment Variables**:
```
BLOB_READ_WRITE_TOKEN=vercel_blob_xxx  # Vercel Blob token
```

**Acceptance Criteria**:
- [ ] Supervisors can upload PDF, PNG, JPG files up to 10MB
- [ ] Files stored in Vercel Blob with private access
- [ ] Document records created with correct metadata
- [ ] Work permits require expiration date
- [ ] Documents retain for 3+ years (no auto-deletion)

---

### Task 4.4: Document Verification Workflow

**Description**: Track document upload status and verification for employee readiness.

**Files to Create**:
- `/packages/backend/src/services/documentation-status.service.ts` - Status calculation

**Files to Modify**:
- `/packages/backend/src/services/employee.service.ts` - Include status in responses
- `/shared/types/src/api.ts` - Add DocumentationStatus type

**Business Logic**:

```typescript
interface DocumentationStatus {
  isComplete: boolean;
  missingDocuments: DocumentType[];
  expiringDocuments: Array<{
    type: DocumentType;
    expiresAt: string;
    daysUntilExpiry: number;
  }>;
  hasValidConsent: boolean;
  hasValidWorkPermit: boolean | null; // null if not required
  safetyTrainingComplete: boolean;
}

async function getDocumentationStatus(employeeId: string): Promise<DocumentationStatus> {
  // 1. Get employee age
  // 2. Determine required documents
  // 3. Query existing valid documents (not invalidated, not expired)
  // 4. Calculate missing/expiring
  // 5. Return status
}
```

**Acceptance Criteria**:
- [ ] Status shows all missing required documents
- [ ] Status shows documents expiring within 30 days
- [ ] Employees cannot submit timesheets without complete documentation (prepare check)
- [ ] Safety training tracked as boolean flag

---

### Task 4.5: Consent Revocation

**Description**: Allow immediate blocking of employee access when consent is revoked.

**Files to Modify**:
- `/packages/backend/src/services/document.service.ts` - Revocation logic
- `/packages/backend/src/middleware/auth.middleware.ts` - Check documentation status

**Implementation**:

```typescript
// DELETE /api/documents/:id (already defined in 4.3)
// This invalidates the document by setting invalidatedAt timestamp

// In auth.middleware.ts, add documentation check:
async function checkDocumentationComplete(employeeId: string): Promise<boolean> {
  const status = await getDocumentationStatus(employeeId);
  return status.isComplete;
}

// Modify requireAuth to optionally enforce documentation
// For timesheet access, documentation must be complete
// For profile view, allow access even without complete docs
```

**Acceptance Criteria**:
- [ ] Supervisors can invalidate consent documents immediately
- [ ] Invalidation preserves document history (no delete)
- [ ] Employee blocked from timesheet access after consent revocation
- [ ] Historical timesheets remain accessible (read-only)

---

### Task 4.6: Supervisor Dashboard API

**Description**: Endpoints to power the supervisor dashboard view.

**Files to Create**:
- `/packages/backend/src/routes/dashboard.ts` - Dashboard routes

**Files to Modify**:
- `/packages/backend/src/app.ts` - Mount dashboard routes

**Endpoints**:

| Method | Path | Auth | Role | Purpose |
|--------|------|------|------|---------|
| GET | `/api/dashboard/employees` | requireAuth | supervisor | Employees with doc status |
| GET | `/api/dashboard/alerts` | requireAuth | supervisor | Pending actions |

**Implementation**:

```typescript
// GET /api/dashboard/employees
// Returns: List of employees with documentation status summary
{
  employees: Array<{
    id: string;
    name: string;
    email: string;
    age: number;
    ageBand: AgeBand;
    status: EmployeeStatus;
    documentation: {
      isComplete: boolean;
      missingCount: number;
      expiringCount: number;
    };
  }>;
}

// GET /api/dashboard/alerts
// Returns: Pending actions for supervisor
{
  alerts: Array<{
    type: 'missing_document' | 'expiring_document' | 'age_transition';
    employeeId: string;
    employeeName: string;
    message: string;
    dueDate?: string;
  }>;
}
```

**Acceptance Criteria**:
- [ ] Dashboard shows all employees with quick status indicators
- [ ] Alerts list actionable items for supervisor
- [ ] Includes expiring work permits (30 days)
- [ ] Includes upcoming 14th birthdays (30 days)

---

### Task 4.7: Frontend - Supervisor Dashboard UI

**Description**: Build React UI for employee management.

**Files to Create**:
- `/packages/frontend/src/pages/Dashboard.tsx` - Main dashboard
- `/packages/frontend/src/pages/EmployeeList.tsx` - Employee list view
- `/packages/frontend/src/pages/EmployeeDetail.tsx` - Single employee view
- `/packages/frontend/src/pages/AddEmployee.tsx` - Add employee form
- `/packages/frontend/src/components/DocumentUpload.tsx` - Upload widget
- `/packages/frontend/src/components/DocumentationStatus.tsx` - Status badge
- `/packages/frontend/src/components/AlertsBanner.tsx` - Alerts display
- `/packages/frontend/src/hooks/useEmployees.ts` - API hooks
- `/packages/frontend/src/hooks/useDocuments.ts` - Document API hooks

**Files to Modify**:
- `/packages/frontend/src/App.tsx` - Add routes
- `/packages/frontend/src/api/client.ts` - Add API methods (create if needed)

**UI Components**:

1. **Employee List Page**:
   - Table with columns: Name, Email, Age, Status, Documentation
   - Filter by status (active/archived)
   - Search by name/email
   - Add Employee button

2. **Employee Detail Page**:
   - Profile info (name, email, DOB, age)
   - Edit button (opens modal)
   - Documentation section:
     - Required documents checklist
     - Upload button for each type
     - Status indicators (missing/valid/expiring)
   - Archive button

3. **Add Employee Form**:
   - Name, Email, DOB, Supervisor checkbox, Temp password
   - Age validation feedback
   - Required documents preview

4. **Document Upload Widget**:
   - Drag-and-drop or click to upload
   - File type validation (PDF, PNG, JPG)
   - Progress indicator
   - Expiration date picker (for work permits)

**Acceptance Criteria**:
- [ ] Supervisors can view employee list with documentation status
- [ ] Supervisors can add new employees with required fields
- [ ] Supervisors can upload documents for employees
- [ ] Supervisors can see expiring/missing document alerts
- [ ] Mobile-responsive layout

---

### Task 4.8: Tests

**Description**: Comprehensive test coverage for Phase 4 functionality.

**Unit Tests** (`/packages/backend/src/__tests__/`):

1. **Age Validation Tests** - `services/employee.service.test.ts`:
   - Reject age < 12
   - Correct required documents for each age band
   - COPPA flag for 12-13
   - No requirements for 18+

2. **Document Service Tests** - `services/document.service.test.ts`:
   - Upload creates correct record
   - Invalidation sets timestamp
   - Expiration check works
   - Missing document detection

3. **Documentation Status Tests** - `services/documentation-status.service.test.ts`:
   - Complete status when all docs present
   - Missing docs listed correctly
   - Expiring docs detected at 30 days
   - Status changes when docs invalidated

**Integration Tests**:

4. **Employee Lifecycle Tests** - `routes/employees.test.ts`:
   - Create employee → verify database record
   - Upload documents → verify blob and database
   - Update employee → verify changes
   - Archive employee → verify status change
   - Access control (supervisor only)

5. **Documentation Blocking Tests**:
   - Employee without docs cannot submit timesheet (prepare for Phase 6)
   - Employee with revoked consent blocked immediately
   - Employee with expired permit blocked

**E2E Tests** (`/e2e/`):

6. **Supervisor Workflow E2E** - `employee-management.spec.ts`:
   - Login as supervisor
   - Add new 14-year-old employee
   - Upload parental consent
   - Upload work permit
   - Verify documentation complete
   - Archive employee

**Acceptance Criteria**:
- [ ] All unit tests pass
- [ ] Integration tests cover CRUD + documents
- [ ] E2E test covers full supervisor workflow
- [ ] Edge cases tested (age boundaries, expiration dates)

---

## Files Summary

### New Files

| File | Description |
|------|-------------|
| `packages/backend/src/routes/employees.ts` | Employee CRUD endpoints |
| `packages/backend/src/routes/documents.ts` | Document upload/management endpoints |
| `packages/backend/src/routes/dashboard.ts` | Dashboard data endpoints |
| `packages/backend/src/services/employee.service.ts` | Employee business logic |
| `packages/backend/src/services/document.service.ts` | Document business logic |
| `packages/backend/src/services/storage.service.ts` | Vercel Blob integration |
| `packages/backend/src/services/documentation-status.service.ts` | Status calculation |
| `packages/backend/src/validation/employee.schema.ts` | Employee Zod schemas |
| `packages/backend/src/validation/document.schema.ts` | Document Zod schemas |
| `packages/frontend/src/pages/Dashboard.tsx` | Supervisor dashboard |
| `packages/frontend/src/pages/EmployeeList.tsx` | Employee list |
| `packages/frontend/src/pages/EmployeeDetail.tsx` | Employee detail view |
| `packages/frontend/src/pages/AddEmployee.tsx` | Add employee form |
| `packages/frontend/src/components/DocumentUpload.tsx` | Upload widget |
| `packages/frontend/src/components/DocumentationStatus.tsx` | Status badge |
| `packages/frontend/src/components/AlertsBanner.tsx` | Alerts display |
| `packages/frontend/src/hooks/useEmployees.ts` | Employee API hooks |
| `packages/frontend/src/hooks/useDocuments.ts` | Document API hooks |

### Modified Files

| File | Changes |
|------|---------|
| `packages/backend/src/app.ts` | Mount new routes |
| `packages/backend/src/config/env.ts` | Add BLOB_READ_WRITE_TOKEN |
| `packages/backend/src/services/auth.service.ts` | Add age validation |
| `packages/backend/src/middleware/auth.middleware.ts` | Add documentation check |
| `packages/backend/package.json` | Add @vercel/blob |
| `shared/types/src/api.ts` | Add employee/document API types |
| `packages/frontend/src/App.tsx` | Add routes |

---

## Dependencies to Install

```bash
# Backend
cd packages/backend
npm install @vercel/blob multer
npm install -D @types/multer
```

---

## Environment Variables

Add to `/packages/backend/.env.example`:
```
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
```

---

## Execution Order

1. **Task 4.2**: Age validation (foundation for everything)
2. **Task 4.1**: Employee CRUD API
3. **Task 4.3**: Document upload with Vercel Blob
4. **Task 4.4**: Documentation status service
5. **Task 4.5**: Consent revocation
6. **Task 4.6**: Dashboard API
7. **Task 4.7**: Frontend UI
8. **Task 4.8**: Tests (write alongside each task)

---

## Requirements Traceability

| Requirement | Task | Status |
|-------------|------|--------|
| REQ-001.1: Create employee records | 4.1 | |
| REQ-001.2: Calculate age from DOB | 4.2 | |
| REQ-001.3: Reject age < 12 | 4.2 | |
| REQ-001.4: Determine required docs | 4.2, 4.4 | |
| REQ-001.5: Send credentials email | Existing (Phase 3) | ✅ |
| REQ-001.6: Support ages 12-99 | 4.2 | |
| REQ-002.1: Require parental consent for <18 | 4.4 | |
| REQ-002.2: Require work permit for 14-17 | 4.4 | |
| REQ-002.3: Block timesheet without docs | 4.5 | |
| REQ-002.4: COPPA disclosure for <13 | 4.2 | |
| REQ-002.5: Track upload date, allow replacement | 4.3 | |
| REQ-002.6: 3-year secure retention | 4.3 | |
| REQ-003.1: Safety training flag required | 4.4 | |
| REQ-003.2: Block submission without training | 4.5 | |
| REQ-003.3: Supervisors mark training complete | 4.3 | |
| REQ-027.1: View profile | 4.1 | |
| REQ-027.2: Update email | 4.1 | |
| REQ-027.3: Change password | Existing (Phase 3) | ✅ |
| REQ-027.4: Cannot change DOB | 4.1 | |
| REQ-028.1: Invalidate consent | 4.5 | |
| REQ-028.2: Immediately block access | 4.5 | |
| REQ-028.3: Preserve historical timesheets | 4.5 | |
| REQ-028.4: Require new consent for access | 4.5 | |

---

## Design Document Properties Validated

| Property | How Validated |
|----------|---------------|
| P2: Documentation Prerequisite | Documentation status check before timesheet access |

---

## Risk Mitigation

1. **Vercel Blob Integration**: Test locally with environment variables before deploying. Blob SDK supports local development mode.

2. **File Size/Type**: Enforce limits server-side with multer before attempting upload.

3. **Age Calculation Edge Cases**: Existing age.ts utility handles birthdays correctly - add comprehensive tests.

4. **Documentation Blocking**: Implement as middleware enhancement to avoid breaking existing auth flow.

---

## Post-Phase Checklist

- [ ] All employees can be created, viewed, updated, archived
- [ ] Documents upload to Vercel Blob successfully
- [ ] Documentation status calculates correctly for all age bands
- [ ] Consent revocation immediately blocks access
- [ ] Dashboard shows employees with status indicators
- [ ] All tests pass
- [ ] No regressions in Phase 3 auth functionality
