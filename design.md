# Renewal Initiatives Timesheet Application - Design Document

## 1. Overview

### Problem Restated

Renewal Initiatives must employ youth workers (ages 12-17) in compliance with complex federal and Massachusetts child labor laws that vary by age band, task type, and school status. Manual enforcement is error-prone and the penalties for violations are severe.

### Solution Approach

Build a compliance-first timesheet application that:

- **Prevents** non-compliant entries at the point of submission (not after-the-fact detection)
- **Guides** employees through rules with clear, actionable error messages
- **Preserves** complete audit trails for regulatory defense
- **Simplifies** supervisor workflow to approve/reject with full visibility

The system enforces 37 compliance rules across 5 age bands, with task-coded time entry enabling accurate multi-rate pay calculations.

---

## 2. Key Design Principles

1. **Compliance is non-negotiable** - No user role, configuration, or workaround can bypass compliance rules. Rules are enforced in code, not policy.

2. **Fail closed, not open** - When in doubt, block the action. It's better to reject a compliant timesheet (employee can resubmit) than approve a non-compliant one.

3. **Guide, don't just block** - Every error message must explain what went wrong AND how to fix it. Employees should succeed on their next attempt.

4. **Audit trail is sacred** - Employee-entered data is immutable after submission. Supervisors cannot edit, only reject. Every compliance check is logged.

5. **Age is calculated per day** - An employee turning 14 mid-week has different rules applied to different days within the same timesheet.

---

## 3. Technology Approach

> **Note**: Technology stack decisions will be finalized via `/tech-stack` discussion. This section will be populated after that conversation.

### Anticipated Architecture Patterns

- Web application (responsive for mobile use in the field)
- Relational database for structured compliance data and audit trails
- Server-side compliance rule engine (not client-side validation alone)
- Email service for notifications
- Document storage for consent forms and permits
- Export capability (CSV) with data model ready for future API integration

---

## 4. Correctness Properties

These invariants must hold across all valid system states. They derive directly from requirements and compliance rules.

### P1: Age-Based Rule Application

**For any** timesheet entry, **the compliance rules applied must match the employee's age on the specific date of that entry**, not their current age or age at submission time.

_Validates: REQ-020, RULE-031_

### P2: Documentation Prerequisite

**For any** employee under 18, **no timesheet can be submitted unless all required documentation (parental consent, work permit if applicable, safety training) has been uploaded and verified**.

_Validates: REQ-002, REQ-003, RULE-001, RULE-006, RULE-007, RULE-027, RULE-028, RULE-030_

### P3: Hour Limit Enforcement

**For any** timesheet submitted by an employee in age band X, **the sum of hours must not exceed the daily limit for that age band on any date, AND must not exceed the weekly limit for that age band**.

| Age Band           | Daily Limit | Weekly Limit         |
| ------------------ | ----------- | -------------------- |
| 12-13              | 4 hrs       | 24 hrs               |
| 14-15 (school day) | 3 hrs       | 18 hrs (school week) |
| 16-17              | 9 hrs       | 48 hrs               |
| 18+                | None        | None                 |

_Validates: REQ-006, REQ-007, REQ-008, RULE-002, RULE-003, RULE-008, RULE-009, RULE-014, RULE-015_

### P4: Task-Age Compatibility

**For any** timesheet entry, **the task code's minimum age attribute must be less than or equal to the employee's age on the date of that entry**.

_Validates: REQ-009, RULE-005, RULE-012, RULE-019, RULE-024_

### P5: Time Window Compliance

**For any** timesheet entry by an employee under 18 on a school day, **no portion of the work period may fall within school hours (7 AM - 3 PM ET)**.

_Validates: REQ-006, REQ-007, RULE-004, RULE-010, RULE-036_

### P6: Supervisor Immutability

**For any** timesheet in "Submitted" or "Approved" status, **supervisor actions are limited to: add note, approve, reject**. No modification of employee-entered data is permitted.

_Validates: REQ-012, RULE-034_

### P7: Rate Version Integrity

**For any** payroll calculation, **the hourly rate applied must be the rate that was effective on the date the work was performed**, not the current rate.

_Validates: REQ-014, REQ-016_

### P8: Audit Completeness

**For any** timesheet submission attempt, **a compliance check record must be created containing: all rules evaluated, result (pass/fail/N/A), timestamp, employee ID, timesheet ID**.

_Validates: REQ-011, REQ-022, RULE-035_

---

## 5. Business Logic Flows

### 5.1 Employee Onboarding Flow

```
START
  ├─ Supervisor enters employee info (name, DOB, email)
  ├─ System calculates age
  │
  ├─ IF age < 12
  │     └─ REJECT: "Minimum age for employment is 12"
  │
  ├─ IF age 12-13
  │     └─ Require: Parental consent (with COPPA), Safety training
  │
  ├─ IF age 14-17
  │     └─ Require: Parental consent, Work permit, Safety training
  │
  ├─ IF age 18+
  │     └─ Require: None (standard onboarding)
  │
  ├─ WAIT until all required documents uploaded
  │
  └─ Send credentials email to employee
END
```

### 5.2 Timesheet Entry Flow

```
START
  ├─ Employee logs in
  ├─ System checks: documentation complete?
  │     └─ IF NO: Block with message listing missing items
  │
  ├─ Employee selects work week (default: current week)
  │     └─ IF past week & locked: Block unless supervisor has unlocked
  │
  ├─ System displays entry form
  │     ├─ Task dropdown filtered by employee age
  │     ├─ School day flags pre-populated per RULE-037
  │     └─ Running totals displayed
  │
  ├─ Employee enters time entries
  │     ├─ For each entry: start time, end time, task code
  │     ├─ IF task requires supervisor attestation AND employee <18
  │     │     └─ Prompt for supervisor name
  │     └─ System calculates hours, updates running totals
  │
  ├─ Employee clicks SUBMIT
  │
  └─ Proceed to Compliance Check Flow
END
```

### 5.3 Compliance Check Flow

```
START (triggered on submit)
  │
  ├─ FOR each day in timesheet:
  │     ├─ Calculate employee age on that date
  │     ├─ Determine applicable rules for that age band
  │     └─ Run rules:
  │           ├─ Daily hour limit
  │           ├─ School hours prohibition (if school day)
  │           ├─ Time window check
  │           ├─ Task-age compatibility
  │           ├─ Meal break check (if >6 hrs)
  │           └─ Supervisor attestation check (if required)
  │
  ├─ Run weekly rules:
  │     ├─ Weekly hour limit
  │     ├─ Day count limit (16-17 only: max 6 days)
  │     └─ Night work restrictions
  │
  ├─ Log ALL check results to compliance_log table
  │
  ├─ IF any rule FAILED:
  │     ├─ Set timesheet status = "Open"
  │     ├─ Return all error messages with remediation guidance
  │     └─ Highlight failing cells/rows
  │
  ├─ IF all rules PASSED:
  │     ├─ Set timesheet status = "Submitted"
  │     └─ Add to supervisor review queue
  │
END
```

### 5.4 Supervisor Review Flow

```
START
  ├─ Supervisor logs in
  ├─ Dashboard shows: timesheets pending review (count)
  │
  ├─ Supervisor selects employee
  │     └─ System shows oldest "Submitted" timesheet by default
  │
  ├─ Timesheet displayed READ-ONLY:
  │     ├─ All entries with hours, tasks, rates
  │     ├─ School day flags and any override notes
  │     ├─ Supervisor attestation records
  │     ├─ Compliance check log summary
  │     └─ Calculated totals and estimated pay
  │
  ├─ Supervisor may add notes
  │
  ├─ Supervisor clicks APPROVE or REJECT
  │
  ├─ IF APPROVE:
  │     ├─ Set status = "Approved"
  │     ├─ Record approval timestamp and supervisor ID
  │     └─ Trigger payroll calculation
  │
  ├─ IF REJECT:
  │     ├─ Set status = "Open"
  │     ├─ Notes become visible to employee
  │     └─ Employee notified to revise and resubmit
  │
END
```

### 5.5 Payroll Calculation Flow

```
START (triggered on approval)
  │
  ├─ FOR each entry in timesheet:
  │     ├─ Look up task code
  │     ├─ Find rate effective on date of work
  │     ├─ Calculate: hours × rate
  │     └─ Classify as agricultural or non-agricultural
  │
  ├─ Sum totals by classification
  │
  ├─ Check overtime eligibility:
  │     ├─ Agricultural hours: exempt from overtime
  │     ├─ Non-agricultural hours >40/week: calculate OT
  │           ├─ Weighted average rate = total_earnings / total_hours
  │           └─ OT premium = (hours_over_40) × (weighted_rate × 0.5)
  │
  ├─ Store payroll record:
  │     ├─ Employee, period, task breakdown
  │     ├─ Regular earnings, OT earnings
  │     └─ Total due
  │
  ├─ Add to export queue
  │
END
```

### 5.6 Age Transition Alert Flow

```
DAILY (scheduled job)
  │
  ├─ Query employees where: birthday within next 30 days
  │
  ├─ FOR each matching employee:
  │     ├─ IF turning 14:
  │     │     ├─ Create dashboard alert: "Work permit required"
  │     │     └─ Send email to supervisors
  │     │
  │     ├─ IF turning 16 or 18:
  │     │     └─ Create dashboard alert: "Rules changing"
  │
  ├─ Query employees where: work permit expires within 30 days
  │     └─ Create alerts and send emails
  │
END
```

---

## 6. Error Handling Strategy

### User Errors (Expected, Guiding)

These are compliance violations or data entry mistakes. The system should:

- Block the action
- Explain what went wrong in plain language
- Provide specific remediation steps
- Highlight the problematic field(s)

**Example error messages:**

- "Daily hour limit exceeded: Ages 12-13 may work maximum 4 hours per day. You entered 5.5 hours on Monday, January 15. Please reduce hours to 4.0 or less."
- "School hours reminder: You logged 3 hours on Tuesday, which is marked as a school day. Ages 14-15 may not work during school hours (7:00 AM - 3:00 PM). Please confirm your work was outside these hours, or update the school day designation."
- "Work permit required: You turned 14 on December 11. Massachusetts law requires a Youth Employment Permit before you can submit timesheets. Please contact your supervisor immediately."

### System Errors (Unexpected, Logging)

These are technical failures. The system should:

- Log full details for debugging
- Show user-friendly message without technical details
- Allow retry where safe
- Alert administrators for critical failures

**Example handling:**

- Database timeout: "Unable to save your timesheet. Please try again in a moment." (Log: connection details, query, timestamp)
- Email send failure: Log and queue for retry; don't block user workflow

---

## 7. Testing Strategy

### Unit Tests

- **Compliance rule functions**: Each of the 37 rules tested in isolation with edge cases
  - Age exactly on boundary (12.00, 14.00, 16.00, 18.00)
  - Hours exactly at limit (4.0, 24.0, etc.)
  - Time exactly at window boundaries (7:00 AM, 3:00 PM, etc.)
  - Birthday falling mid-week
  - School day overrides

- **Payroll calculations**
  - Single task, single rate
  - Multiple tasks, multiple rates
  - Weighted overtime calculation
  - Rate version effective date lookups

### Integration Tests

- **Full submission flow**: Entry → Compliance check → Status change
- **Rejection/resubmit cycle**: Submit → Reject → Edit → Resubmit → Approve
- **Documentation blocking**: Attempt submission with missing permit → Blocked
- **Age transition**: Simulate clock advancement through 14th birthday

### Property-Based Tests

Test the correctness properties (Section 4) with generated data:

- Generate random timesheets and verify age-rule matching (P1)
- Generate employees with various documentation states and verify blocking (P2)
- Generate random hour combinations and verify limit enforcement (P3)

### Manual/Exploratory Tests

- **Usability**: Can a 12-year-old complete a timesheet in <5 minutes?
- **Error guidance**: Are error messages clear enough for first-attempt resolution?
- **Mobile**: Does the interface work on a phone in the field?

### Verification Checklist

Before deployment:

1. [ ] All 37 compliance rules have passing unit tests
2. [ ] Edge cases documented and tested (birthdays, boundaries, transitions)
3. [ ] Payroll export CSV matches expected format
4. [ ] Email notifications delivered for expiring permits
5. [ ] 3-year-old data still accessible (retention test)
6. [ ] Password reset flow works end-to-end
7. [ ] Performance: compliance check < 5 seconds on 7-day timesheet

---

## 8. Data Model Sketch

### Core Entities

```
Employee
├─ id
├─ name
├─ email
├─ date_of_birth
├─ is_supervisor: boolean
├─ status: active | archived
├─ created_at
└─ updated_at

EmployeeDocument
├─ id
├─ employee_id (FK)
├─ type: parental_consent | work_permit | safety_training
├─ file_path
├─ uploaded_at
├─ uploaded_by (supervisor FK)
├─ expires_at (nullable, for work permits)
└─ invalidated_at (nullable, for revocation)

TaskCode
├─ id
├─ code (e.g., "F1", "R2")
├─ name
├─ description
├─ is_agricultural: boolean
├─ is_hazardous: boolean
├─ supervisor_required: none | for_minors | always
├─ solo_cash_handling: boolean
├─ driving_required: boolean
├─ power_machinery: boolean
├─ min_age_allowed: integer
├─ created_at
└─ updated_at

TaskCodeRate
├─ id
├─ task_code_id (FK)
├─ hourly_rate: decimal
├─ effective_date: date
├─ justification_notes: text (nullable)
└─ created_at

Timesheet
├─ id
├─ employee_id (FK)
├─ week_start_date: date (Sunday)
├─ status: open | submitted | approved | rejected
├─ submitted_at (nullable)
├─ reviewed_by (supervisor FK, nullable)
├─ reviewed_at (nullable)
├─ supervisor_notes: text (nullable)
├─ created_at
└─ updated_at

TimesheetEntry
├─ id
├─ timesheet_id (FK)
├─ work_date: date
├─ task_code_id (FK)
├─ start_time: time
├─ end_time: time
├─ hours: decimal (calculated)
├─ is_school_day: boolean
├─ school_day_override_note: text (nullable)
├─ supervisor_present_name: text (nullable)
├─ meal_break_confirmed: boolean (nullable)
└─ created_at

ComplianceCheckLog
├─ id
├─ timesheet_id (FK)
├─ rule_id: string (e.g., "RULE-002")
├─ result: pass | fail | not_applicable
├─ details: jsonb (specific values checked)
├─ checked_at
└─ employee_age_on_date: integer

PayrollRecord
├─ id
├─ timesheet_id (FK)
├─ employee_id (FK)
├─ period_start: date
├─ period_end: date
├─ agricultural_hours: decimal
├─ agricultural_earnings: decimal
├─ non_agricultural_hours: decimal
├─ non_agricultural_earnings: decimal
├─ overtime_hours: decimal
├─ overtime_earnings: decimal
├─ total_earnings: decimal
├─ calculated_at
└─ exported_at (nullable)
```

---

## 9. Out of Scope for V1

Items explicitly deferred:

- QuickBooks API integration (export-ready data model, manual CSV process for now)
- Volunteer hour tracking
- Incident/injury reporting
- Team/crew tracking
- Multi-location support (single MA farm)

---

## 10. Next Steps

1. Run `/tech-stack` to finalize technology choices
2. Generate implementation phases with `/plan-phase`
3. Build core infrastructure (auth, database, basic UI)
4. Implement compliance rule engine
5. Build timesheet entry and submission flow
6. Build supervisor review workflow
7. Add reporting and export
8. Testing and deployment
