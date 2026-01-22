# Implementation Plan - Renewal Initiatives Timesheet Application

## Overview

This plan outlines the phased implementation of a compliance-first timesheet application for Renewal Initiatives. The application enforces federal and Massachusetts child labor laws for youth workers (ages 12-17) on a regenerative farm.

**Core deliverables:**

- Web-based timesheet entry for employees
- 37 compliance rules enforced at submission time
- Supervisor review/approval workflow
- Document management (consent forms, work permits)
- Payroll calculation with multi-rate support
- 3-year audit trail retention

**Technology stack:** Node.js/Express/TypeScript backend, React/TypeScript frontend, PostgreSQL database, hosted on Vercel.

---

## Phase 0: Technology Stack Decisions

**Status**: Complete

See [technology_decisions.md](technology_decisions.md) for all decisions and rationale.

---

## Phase 1: Project Scaffolding & Development Environment

**Goal**: Set up the foundational project structure and local development environment.

**Tasks**:

1. Initialize monorepo structure (frontend + backend packages)
2. Configure TypeScript for both packages with shared types
3. Set up Express server with basic health check endpoint
4. Set up React app with Vite
5. Configure Vitest for both packages
6. Set up Playwright for E2E testing
7. Configure ESLint and Prettier for code consistency
8. Create initial Vercel project and connect GitHub repo
9. Set up local PostgreSQL database (or Vercel Postgres dev branch)
10. Configure environment variables (.env.local, .env.example)

**Deliverable**: Running local dev environment with "Hello World" frontend calling backend API, deployed to Vercel preview.

---

## Phase 2: Database Schema & ORM Setup

**Goal**: Implement the data model from design.md with type-safe database access.

**Tasks**:

1. Choose and configure ORM (Prisma or Drizzle)
2. Create schema for core entities:
   - Employee (with age calculation)
   - EmployeeDocument
   - TaskCode
   - TaskCodeRate (rate versioning)
   - Timesheet
   - TimesheetEntry
   - ComplianceCheckLog
   - PayrollRecord
3. Set up database migrations
4. Create seed script with test data (employees across age bands, sample task codes)
5. Write unit tests for age calculation helper
6. Configure Vercel Postgres connection with connection pooling

**Deliverable**: Fully migrated database with seed data, ORM configured and tested.

---

## Phase 3: Authentication System

**Goal**: Implement secure email/password authentication with account management.

**Tasks**:

1. Implement password hashing with bcrypt
2. Create user registration endpoint (supervisor-initiated)
3. Create login endpoint with JWT token generation
4. Implement session storage in PostgreSQL
5. Create password reset flow:
   - Request reset endpoint (generates token, sends Postmark email)
   - Reset password endpoint (validates token, updates password)
6. Implement failed login tracking and account lockout (5 attempts)
7. Create authentication middleware for protected routes
8. Write tests for all auth flows

**Deliverable**: Working auth system with login, logout, password reset, and account lockout.

---

## Phase 4: Employee & Document Management

**Goal**: Enable supervisor management of employees and required documentation.

**Tasks**:

1. Create employee CRUD API endpoints
2. Implement age validation (reject < 12)
3. Determine required documents based on age:
   - Ages 12-13: Parental consent (with COPPA disclosure)
   - Ages 14-17: Parental consent + work permit
   - Ages 18+: None required
4. Implement document upload to Vercel Blob
5. Create document verification workflow
6. Implement consent revocation (immediate access block)
7. Build supervisor dashboard UI:
   - Employee list with documentation status
   - Add/edit employee form
   - Document upload interface
8. Write integration tests for employee lifecycle

**Deliverable**: Supervisors can create employees, upload documents, and manage documentation status.

---

## Phase 5: Task Code Management

**Goal**: Enable supervisors to create and manage task codes with compliance attributes.

**Tasks**:

1. Create task code CRUD API endpoints
2. Implement rate versioning (effective dates, historical rates)
3. Store compliance attributes:
   - Agricultural vs non-agricultural classification
   - Hazardous flag
   - Supervisor-required flag (none/for_minors/always)
   - Minimum age allowed
   - Solo cash handling, driving, power machinery flags
4. Build task code management UI
5. Implement task filtering by employee age
6. Seed initial task codes from requirements (F1-F6, R1-R2, A1-A2, etc.)
7. Write tests for rate versioning logic

**Deliverable**: Task code system with full compliance attributes and rate history.

---

## Phase 6: Timesheet Entry Interface

**Goal**: Build the employee timesheet entry experience with real-time feedback.

**Tasks**:

1. Create timesheet API endpoints (create, read, update)
2. Implement week selection (Sunday-Saturday, default current week)
3. Build timesheet entry UI:
   - Date/day grid for the week
   - Task code dropdown (filtered by age)
   - Start time, end time inputs
   - Auto-calculated hours
   - Running daily and weekly totals
4. Implement school day tracking:
   - Default calculation (Mon-Fri during Aug 28 - Jun 20)
   - Override capability with required note
5. Add supervisor attestation prompt for flagged tasks
6. Add meal break confirmation prompt (for >6 hours)
7. Show visual warnings when approaching limits
8. Lock submitted timesheets from editing
9. Write component tests for timesheet grid

**Deliverable**: Employees can enter time with real-time feedback on limits.

---

## Phase 7: Compliance Rule Engine

**Goal**: Implement all 37 compliance rules with clear error messaging.

**Tasks**:

1. Design rule engine architecture (pluggable rules, per-day evaluation)
2. Implement age calculation per work date (birthday mid-period handling)
3. Implement hour limit rules:
   - RULE-002/003: Ages 12-13 daily (4hr) and weekly (24hr) limits
   - RULE-008/009: Ages 14-15 school day (3hr) and school week (18hr) limits
   - RULE-014/015: Ages 16-17 daily (9hr) and weekly (48hr) limits
4. Implement time window rules:
   - RULE-004/010: School hours prohibition (7 AM - 3 PM on school days)
   - RULE-011: Ages 14-15 work window (7 AM - 7 PM, extended to 9 PM Jun-Labor Day)
   - RULE-016/017: Ages 16-17 work window (6 AM - 10 PM, extended on non-school nights)
5. Implement task restriction rules:
   - RULE-005/012/019/024: Age-based task filtering
   - RULE-018: 6-day max for ages 16-17
6. Implement documentation rules:
   - RULE-001/006/007: Parental consent requirements
   - RULE-027/028/030: Work permit requirements
7. Implement most-restrictive resolution (REQ-021)
8. Create compliance check logging (all results to ComplianceCheckLog)
9. Generate actionable error messages with remediation guidance
10. Write comprehensive unit tests for each rule (edge cases: boundaries, birthdays)

**Deliverable**: Full compliance engine that blocks non-compliant submissions with clear guidance.

---

## Phase 8: Submission & Review Workflow

**Goal**: Implement the submit → review → approve/reject workflow.

**Tasks**:

1. Create submission endpoint that triggers compliance check
2. Implement status transitions: Open → Submitted → Approved/Rejected
3. Build supervisor review UI:
   - Queue of pending timesheets
   - Read-only timesheet display
   - Compliance check summary
   - Notes field
   - Approve/Reject buttons
4. Implement rejection flow (returns to Open, notes visible to employee)
5. Implement historical week unlocking (supervisor can unlock past weeks)
6. Ensure audit trail immutability (no editing after submission)
7. Write E2E tests for full submission cycle

**Deliverable**: Complete workflow from entry through approval with full audit trail.

---

## Phase 9: Payroll Calculation & Export

**Goal**: Calculate pay accurately with multi-rate and overtime support.

**Tasks**:

1. Implement base pay calculation (hours × rate using effective date)
2. Apply minimum wage floors ($8/hr agricultural, $15/hr non-agricultural)
3. Implement weighted-average overtime calculation:
   - Non-agricultural hours > 40/week
   - Weighted rate = total_earnings / total_hours
   - OT premium = hours_over_40 × (weighted_rate × 0.5)
4. Exempt agricultural hours from overtime
5. Create PayrollRecord on approval
6. Build payroll report UI (filter by date range, employee)
7. Implement CSV export with required fields
8. Write tests for overtime edge cases

**Deliverable**: Accurate payroll calculations with CSV export for accounting system.

---

## Phase 10: Alerts & Notifications

**Goal**: Proactive notifications for compliance deadlines.

**Tasks**:

1. Implement scheduled job for daily checks (Vercel Cron)
2. Create work permit expiration alerts (30 days before)
3. Create age 14 transition alerts (30 days before, work permit required)
4. Build supervisor dashboard notifications panel
5. Send email notifications via Postmark
6. Show pending review count on login
7. Write tests for alert generation logic

**Deliverable**: Supervisors receive timely alerts about upcoming compliance deadlines.

---

## Phase 11: Reporting & Audit

**Goal**: Provide visibility into operations and compliance history.

**Tasks**:

1. Build reporting UI with filters (date range, employee, task code, age band)
2. Display compliance indicators (warnings, blocks, rejections)
3. Ensure reports use rate effective on date of work
4. Implement read-only report display (no data modification)
5. Create compliance audit report (all check results for date range)
6. Verify 3-year data accessibility
7. Write tests for report calculations

**Deliverable**: Comprehensive reporting for operational visibility and audit support.

---

## Phase 12: Polish & Hardening

**Goal**: Production readiness with security hardening and UX refinement.

**Tasks**:

1. Security audit:
   - Input validation on all endpoints
   - SQL injection prevention (ORM parameterized queries)
   - XSS prevention (React default escaping + CSP headers)
   - CSRF protection
   - Rate limiting on auth endpoints
2. Performance optimization:
   - Compliance check < 5 seconds target
   - Database query optimization
   - Frontend bundle size review
3. Error handling refinement:
   - User-friendly error messages
   - Error logging for debugging
4. Mobile responsiveness testing (field use on phones)
5. Accessibility review (WCAG compliance)
6. Load testing with realistic data volume
7. Documentation: API docs, deployment guide

**Deliverable**: Production-ready application with security hardened and UX polished.

---

## Phase 13: Deployment & Launch

**Goal**: Deploy to production and verify all systems operational.

**Tasks**:

1. Configure production environment variables
2. Run full migration on production database
3. Seed production task codes (verify rates with organization)
4. Create initial supervisor account
5. Full E2E test suite on production
6. Verify email delivery (Postmark production)
7. Verify document upload (Vercel Blob production)
8. Create backup verification procedure
9. Document rollback procedure
10. Soft launch with limited users
11. Monitor for issues, iterate

**Deliverable**: Live production application with real users.

---

## Phase Dependencies

```
Phase 1 (Scaffolding)
    ↓
Phase 2 (Database)
    ↓
Phase 3 (Auth) ←──────────────────┐
    ↓                              │
Phase 4 (Employees) ──────────────┤
    ↓                              │
Phase 5 (Task Codes)              │
    ↓                              │
Phase 6 (Timesheet Entry)         │
    ↓                              │
Phase 7 (Compliance Engine) ──────┘
    ↓
Phase 8 (Submission Workflow)
    ↓
Phase 9 (Payroll)
    ↓
Phase 10 (Alerts)
    ↓
Phase 11 (Reporting)
    ↓
Phase 12 (Polish)
    ↓
Phase 13 (Launch)
```

Note: Phases 4-7 have some parallelism possible, but the compliance engine (Phase 7) depends on all preceding entity types being defined.

---

## Risk Areas & Mitigation

### 1. Compliance Rule Complexity

**Risk**: 37 rules across 5 age bands with edge cases (birthdays, school day overrides) are error-prone.
**Mitigation**: Extensive unit tests for each rule. Property-based testing with generated data. Manual review of edge cases with real-world scenarios.

### 2. COPPA Compliance for Under-13

**Risk**: Handling data for 12-year-olds requires COPPA-compliant parental consent.
**Mitigation**: Built-in auth (no third-party data sharing). Consent form includes COPPA disclosure. Data retention policy documented.

### 3. Vercel Serverless Limitations

**Risk**: Scheduled jobs (alerts) and long-running operations may hit serverless limits.
**Mitigation**: Use Vercel Cron for scheduled jobs. Ensure compliance check completes in <5 seconds. Consider edge functions if needed.

### 4. Data Retention & Backup

**Risk**: 3-year retention requirement with no accidental deletion.
**Mitigation**: Vercel Postgres automated backups. No DELETE operations on core tables (soft delete only). Document backup/restore procedure.

### 5. Minor User Experience

**Risk**: 12-year-olds need to successfully complete timesheets independently.
**Mitigation**: Clear, simple UI. Error messages written for young users. Test with actual youth workers during development.

---

## Success Criteria

Before launch, verify:

- [ ] All 37 compliance rules have passing unit tests
- [ ] Edge cases tested: birthdays mid-week, age boundaries, school day transitions
- [ ] Compliance check completes in < 5 seconds
- [ ] Timesheet submission takes < 5 minutes (usability test)
- [ ] Failed checks provide actionable remediation guidance
- [ ] Supervisor review/approval takes < 1 minute
- [ ] Payroll export CSV matches expected format
- [ ] Email notifications delivered for expiring permits
- [ ] 3-year-old data remains accessible (retention test)
- [ ] Password reset flow works end-to-end
- [ ] Mobile-responsive on common phone sizes
- [ ] Security audit completed (OWASP top 10 reviewed)

---

## Next Steps

Run `/plan-phase 1` to begin detailed planning for Phase 1: Project Scaffolding & Development Environment.
