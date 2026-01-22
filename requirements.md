# Renewal Initiatives Timesheet Application - Requirements

## 1. Introduction

### Organization

**Renewal Initiatives** is a Massachusetts 501(c)(3) nonprofit operating a 56-acre regenerative farm that provides veteran training in sustainable agriculture.

### Problem Statement

Employing youth workers (ages 12-17) requires compliance with complex, sometimes contradictory federal and Massachusetts child labor laws. The regulations govern:

- Maximum daily and weekly hours (varying by age and school status)
- Prohibited time windows (school hours, night work)
- Hazardous occupation restrictions
- Documentation requirements (parental consent, work permits)
- Wage requirements (agricultural vs. non-agricultural task classification)

Manual compliance tracking is error-prone, and penalties for violations are severe. The organization needs an automated system to enforce these rules at the point of timesheet entry.

### Solution Overview

A web-based timesheet application that:

1. **Enforces compliance rules** at submission time, blocking non-compliant entries with clear guidance
2. **Tracks task-coded time** for accurate pay calculations at varying rates
3. **Maintains an audit trail** for regulatory compliance (3-year retention)
4. **Streamlines supervisor review** with read-only approval workflow

### Success Metrics

- ≤1 non-compliant timesheet reaches "Approved" status per year
- Timesheet submission takes <5 minutes per employee
- Compliance checks complete in <5 seconds
- Failed compliance checks provide sufficient guidance for first-attempt resolution
- Supervisor review/approval takes <1 minute per timesheet
- Zero preventable security breaches
- All data retained for minimum 3 years

---

## 2. Glossary

| Term                          | Definition                                                                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Agricultural work**         | Labor directly involved in crop cultivation and harvesting on a farm. Subject to MA agricultural minimum wage ($8/hr).                                  |
| **Non-agricultural work**     | Post-harvest processing, retail, office work, and other tasks. Subject to MA general minimum wage ($15/hr).                                             |
| **School day**                | Monday-Friday during school year (Aug 28 - June 20 default). Affects hour limits and time window restrictions for minors.                               |
| **School hours**              | 7:00 AM - 3:00 PM Eastern Time. Work prohibited during these hours for minors on school days.                                                           |
| **Work permit**               | Massachusetts Youth Employment Permit required for employees ages 14-17. Issued by school officials.                                                    |
| **Parental consent**          | Written authorization from parent/guardian required for employees under 18, mandatory for ages 12-13 in agriculture.                                    |
| **Hazardous occupation**      | Tasks prohibited for minors including operating power machinery, driving, handling toxic chemicals, working from heights, and entering confined spaces. |
| **Task code**                 | Identifier linking work to a specific job type, hourly rate, and compliance attributes (age restrictions, hazard flags).                                |
| **Rate versioning**           | System maintaining historical rates with effective dates; payroll uses rate in effect on date of work.                                                  |
| **Weighted-average overtime** | When employee works multiple task codes at different rates, overtime calculated at 1.5× the weighted average of all rates worked that week.             |

---

## 3. Requirements

### REQ-001: Employee Onboarding

**As a** supervisor, **I want to** enter a new employee's information and create their account, **so that** they can begin working and submitting timesheets.

**Acceptance Criteria:**

1. THE System SHALL allow supervisors to create employee records with: name, date of birth, email address, and role (employee or employee+supervisor).
2. THE System SHALL calculate employee age from date of birth.
3. THE System SHALL reject employee creation if age < 12 with error message explaining minimum age requirement.
4. THE System SHALL determine required documentation based on age (parental consent for <18, work permit for 14-17).
5. THE System SHALL send email with login credentials to new employee after all required documents are uploaded.
6. THE System SHALL support employee ages 12-99.

---

### REQ-002: Minor Documentation Verification

**As a** supervisor, **I want to** upload and verify required consent/permit documents for minors, **so that** no minor can work without legal prerequisites satisfied.

**Acceptance Criteria:**

1. THE System SHALL require parental consent document upload before activating accounts for employees under 18.
2. THE System SHALL require work permit document upload before activating accounts for employees ages 14-17.
3. THE System SHALL block timesheet access for employees with missing or expired documentation.
4. THE System SHALL include COPPA disclosure consent within parental consent documentation for employees under 13.
5. THE System SHALL track document upload date and allow document replacement.
6. THE System SHALL store uploaded documents securely with 3-year minimum retention.

---

### REQ-003: Safety Training Verification

**As a** supervisor, **I want to** confirm safety training completion before a minor can submit time, **so that** the system prevents unsafe or non-compliant work.

**Acceptance Criteria:**

1. THE System SHALL require safety training acknowledgment flag before employee under 18 can submit first timesheet.
2. THE System SHALL block timesheet submission with clear error message if safety training not marked complete.
3. THE System SHALL allow supervisors to mark safety training complete and record completion date.

---

### REQ-004: Task Code Time Entry

**As an** employee, **I want to** record time against task codes, **so that** payroll, compliance, and reporting are accurate and auditable.

**Acceptance Criteria:**

1. THE System SHALL require a valid task code for every timesheet entry row.
2. THE System SHALL display task codes filtered by employee age (hiding age-inappropriate tasks).
3. THE System SHALL show task name, description, and hourly rate for each selectable task.
4. THE System SHALL allow multiple entries per day (for different tasks or split shifts).
5. THE System SHALL capture start time, end time, and task code for each entry.
6. THE System SHALL calculate hours automatically from start/end times.

---

### REQ-005: School Day Tracking

**As an** employee under 18, **I want to** designate whether each date is a school day, **so that** the system applies correct hour and timing limits.

**Acceptance Criteria:**

1. THE System SHALL display school day status for each date on timesheets for employees under 18.
2. THE System SHALL default Monday-Friday during August 28 - June 20 as school days.
3. THE System SHALL default Saturdays, Sundays, and dates outside August 28 - June 20 as non-school days.
4. THE System SHALL allow employees or supervisors to override school day defaults.
5. THE System SHALL require mandatory explanatory note (minimum 10 characters) for any school day override.
6. THE System SHALL make school day designations read-only after timesheet submission.

---

### REQ-006: Age 12-13 Hour Limits

**As an** employee age 12-13, **I want to** be blocked from exceeding daily and weekly hour limits, **so that** my work remains legal.

**Acceptance Criteria:**

1. THE System SHALL block submission if daily hours exceed 4 on any date when employee was age 12-13.
2. THE System SHALL block submission if weekly hours exceed 24 when employee was age 12-13 for any portion of the week.
3. THE System SHALL block submission if any hours are logged during school hours (7 AM - 3 PM) on school days.
4. THE System SHALL display running daily and weekly totals during entry.
5. THE System SHALL show visual warnings when approaching limits.

---

### REQ-007: Age 14-15 Hour Limits

**As an** employee age 14-15, **I want to** be blocked from exceeding school-week caps, **so that** my entries remain compliant.

**Acceptance Criteria:**

1. THE System SHALL block submission if daily hours exceed 3 on school days.
2. THE System SHALL block submission if weekly hours exceed 18 during school weeks (weeks containing at least one school day).
3. THE System SHALL block submission if any hours are logged during school hours (7 AM - 3 PM) on school days.
4. THE System SHALL block submission if any hours are logged outside 7 AM - 7 PM (or 7 AM - 9 PM during June 1 through Labor Day).

---

### REQ-008: Age 16-17 Hour Limits

**As an** employee age 16-17, **I want to** be blocked from exceeding daily, weekly, and day-count caps, **so that** my entries remain compliant.

**Acceptance Criteria:**

1. THE System SHALL block submission if daily hours exceed 9.
2. THE System SHALL block submission if weekly hours exceed 48.
3. THE System SHALL block submission if hours are logged on more than 6 days in a week.
4. THE System SHALL block submission if hours extend past 10 PM on evenings before school days.
5. THE System SHALL block submission if hours are outside 6 AM - 10 PM (or 6 AM - 11:30 PM on non-school nights).

---

### REQ-009: Hazardous Task Restrictions

**As an** employee under 18, **I want to** be restricted from hazardous tasks, **so that** I only perform age-appropriate work.

**Acceptance Criteria:**

1. THE System SHALL filter available task codes based on employee age on date of work.
2. THE System SHALL prevent selection of tasks requiring power machinery for employees under 18.
3. THE System SHALL prevent selection of tasks requiring driving for employees under 18.
4. THE System SHALL prevent selection of tasks involving solo cash handling for employees under 14.
5. THE System SHALL block submission if any entry contains age-inappropriate task for that date.

---

### REQ-010: Supervisor Attestation for Flagged Tasks

**As an** employee under 18 entering time for a supervisor-required task, **I want to** record which supervisor was present, **so that** compliance with supervision requirements is documented.

**Acceptance Criteria:**

1. THE System SHALL prompt for supervisor name when employee under 18 selects a task flagged as "Supervisor Required: Always" (e.g., R2 Farmers' Market/Retail).
2. THE System SHALL require supervisor name entry before that time entry can be saved.
3. THE System SHALL store supervisor attestation with the timesheet entry.

---

### REQ-011: Compliance Check on Submission

**As an** employee, **I want to** have all compliance rules checked when I submit, **so that** only compliant timesheets move forward.

**Acceptance Criteria:**

1. THE System SHALL run all applicable compliance rules when employee clicks Submit.
2. THE System SHALL block submission and return status to "Open" if any rule fails.
3. THE System SHALL display all failed rules with specific error messages and remediation guidance.
4. THE System SHALL highlight specific cells/rows that caused failures.
5. THE System SHALL complete compliance checks within 5 seconds.
6. THE System SHALL log all compliance check results (pass, fail, N/A) for audit trail.

---

### REQ-012: Supervisor Timesheet Review

**As a** supervisor, **I want to** review submitted timesheets and approve or reject them without editing employee data, **so that** the audit trail remains intact.

**Acceptance Criteria:**

1. THE System SHALL display submitted timesheets in read-only mode to supervisors.
2. THE System SHALL allow supervisors to add notes to timesheets.
3. THE System SHALL allow supervisors to Approve or Reject timesheets.
4. THE System SHALL NOT allow supervisors to edit hours, task codes, dates, or employee notes.
5. THE System SHALL return rejected timesheets to "Open" status with supervisor notes visible to employee.
6. THE System SHALL move approved timesheets to payroll processing queue.

---

### REQ-013: Meal Break Verification

**As an** employee under 18 working more than 6 hours, **I want to** confirm I took my required meal break, **so that** compliance is documented.

**Acceptance Criteria:**

1. THE System SHALL prompt for meal break confirmation when daily hours exceed 6 for employees under 18.
2. THE System SHALL require explicit attestation that 30-minute break was taken.
3. THE System SHALL block submission until meal break is confirmed or hours are adjusted.

---

### REQ-014: Payroll Calculation

**As a** supervisor, **I want to** compute earnings from task rates and hours, **so that** pay is correct and documented.

**Acceptance Criteria:**

1. THE System SHALL calculate pay as: hours × task rate (using rate effective on date of work).
2. THE System SHALL apply agricultural minimum wage floor ($8/hr) for agricultural tasks.
3. THE System SHALL apply general minimum wage floor ($15/hr) for non-agricultural tasks.
4. THE System SHALL flag any calculated pay that falls below applicable minimum (should not occur given rate card, but validate).
5. THE System SHALL generate payroll report per employee per pay period.

---

### REQ-015: Weighted Overtime Calculation

**As a** supervisor, **I want to** calculate overtime using weighted-average regular rate when applicable, **so that** overtime compliance is correct.

**Acceptance Criteria:**

1. THE System SHALL calculate weighted-average regular rate when employee works multiple task codes: (sum of rate×hours) / total hours.
2. THE System SHALL apply overtime rate of 1.5× weighted average for hours exceeding 40/week when overtime applies.
3. THE System SHALL exempt agricultural work from overtime per MA law.
4. THE System SHALL display warning to supervisor when overtime threshold approached or exceeded.

---

### REQ-016: Task Code Management

**As a** supervisor, **I want to** create and modify task codes with compliance attributes, **so that** the system can enforce age restrictions and calculate pay correctly.

**Acceptance Criteria:**

1. THE System SHALL allow supervisors to create task codes with: code, name, description, hourly rate, effective date.
2. THE System SHALL require classification as Agricultural or Non-Agricultural.
3. THE System SHALL require hazardous flag (yes/no).
4. THE System SHALL require supervisor-required flag (yes/no/always).
5. THE System SHALL require minimum age allowed.
6. THE System SHALL require attributes for: solo cash handling, driving, power machinery.
7. THE System SHALL preserve historical task code versions (rate versioning with effective dates).
8. THE System SHALL allow rate justification notes for audit documentation.

---

### REQ-017: Work Permit Expiration Alerts

**As a** supervisor, **I want to** be alerted when work permits are expiring, **so that** I can renew documentation before employees become ineligible.

**Acceptance Criteria:**

1. THE System SHALL track work permit expiration dates.
2. THE System SHALL display dashboard alert 30 days before permit expiration.
3. THE System SHALL send email notification 30 days before permit expiration.
4. THE System SHALL block timesheet submission if permit is expired.

---

### REQ-018: Age 14 Transition Alert

**As a** supervisor, **I want to** be alerted when an employee turns 14, **so that** I obtain their required work permit.

**Acceptance Criteria:**

1. THE System SHALL display dashboard alert 30 days before employee's 14th birthday.
2. THE System SHALL send email notification 30 days before employee's 14th birthday.
3. THE System SHALL block timesheet submission on/after 14th birthday until work permit uploaded.
4. THE System SHALL transition employee from 12-13 rules to 14-15 rules on their 14th birthday.

---

### REQ-019: Weekly Timesheet Selection

**As an** employee, **I want to** select a work week and submit time for that week only, **so that** reporting aligns with payroll schedules.

**Acceptance Criteria:**

1. THE System SHALL define work week as Sunday through Saturday.
2. THE System SHALL default to current week for new timesheet entry.
3. THE System SHALL allow selection of historical weeks for viewing approved timesheets (read-only).
4. THE System SHALL lock past weeks by default (cannot create new submissions).
5. THE System SHALL allow supervisors to unlock specific past weeks for specific employees.

---

### REQ-020: Birthday Mid-Period Rule Switching

**As an** employee whose birthday falls during a timesheet week, **I want to** have rules evaluated based on my age on each work date, **so that** compliance changes apply correctly mid-week.

**Acceptance Criteria:**

1. THE System SHALL calculate employee age for each date of work independently.
2. THE System SHALL apply age-appropriate rules for each day based on age on that specific date.
3. THE System SHALL handle rule transitions (e.g., 13→14, 15→16, 17→18) within a single timesheet period.

---

### REQ-021: Most-Restrictive Law Resolution

**As the** organization, **I want to** enforce the most restrictive applicable limit when federal and state rules differ, **so that** we are never non-compliant with either.

**Acceptance Criteria:**

1. THE System SHALL apply MIN(federal_limit, state_limit) for maximum hour restrictions.
2. THE System SHALL apply MAX(federal_minimum, state_minimum) for wage floors.
3. THE System SHALL apply UNION(federal_prohibitions, state_prohibitions) for prohibited tasks.

---

### REQ-022: Data Retention

**As the** organization, **I want to** retain all timesheet data for minimum 3 years, **so that** audits can be supported.

**Acceptance Criteria:**

1. THE System SHALL retain all submitted and approved timesheets with full detail for minimum 3 years.
2. THE System SHALL retain compliance check logs for minimum 3 years.
3. THE System SHALL retain uploaded documents (consent forms, work permits) for minimum 3 years.
4. THE System SHALL NOT automatically delete any timesheet or employee data.
5. THE System SHALL maintain database backups per IT policy.

---

### REQ-023: Payroll Export

**As a** supervisor, **I want to** export approved timesheet data for payroll processing, **so that** I can enter it into our accounting system.

**Acceptance Criteria:**

1. THE System SHALL generate payroll export reports in CSV format.
2. THE System SHALL include: employee name, pay period, task breakdown, hours per task, rates, calculated totals, overtime if applicable.
3. THE System SHALL design data model to support future QuickBooks API integration.

---

### REQ-024: Employee Authentication

**As an** employee, **I want to** log into the system securely, **so that** my timesheet data is protected.

**Acceptance Criteria:**

1. THE System SHALL authenticate users via email and password.
2. THE System SHALL provide password reset via email.
3. THE System SHALL enforce minimum password complexity.
4. THE System SHALL lock accounts after repeated failed login attempts.
5. THE System SHALL use HTTPS for all communications.

---

### REQ-025: Supervisor Notifications

**As a** supervisor, **I want to** be notified of critical events, **so that** I can take timely action.

**Acceptance Criteria:**

1. THE System SHALL display dashboard notifications for: timesheets awaiting review, expiring permits, upcoming age transitions.
2. THE System SHALL send email notifications for: expiring permits (30 days), age 14 transitions (30 days).
3. THE System SHALL show count of pending review items on login.

---

### REQ-026: Reporting

**As a** supervisor, **I want to** generate reports on timesheets, payroll, and compliance, **so that** I have visibility into operations.

**Acceptance Criteria:**

1. THE System SHALL generate reports filterable by: date range, employee, task code, age band.
2. THE System SHALL include compliance indicators (warnings, blocks, overrides, rejections) in reports.
3. THE System SHALL calculate costs using the rate in effect on the date hours were incurred.
4. THE System SHALL display reports as read-only (no modification of underlying data).

---

### REQ-027: User Profile Management

**As an** employee, **I want to** view and update my profile information, **so that** my records stay current.

**Acceptance Criteria:**

1. THE System SHALL allow employees to view their profile (name, email, age).
2. THE System SHALL allow employees to update their email address.
3. THE System SHALL allow employees to change their password.
4. THE System SHALL NOT allow employees to change their date of birth (supervisor-only).

---

### REQ-028: Revoke Parental Consent

**As a** supervisor, **I want to** immediately revoke parental consent when a parent provides written notice, **so that** the minor is blocked from working until new consent is filed.

**Acceptance Criteria:**

1. THE System SHALL allow supervisors to invalidate existing parental consent.
2. THE System SHALL immediately block timesheet access for affected employee.
3. THE System SHALL preserve historical timesheet records for the employee.
4. THE System SHALL require new consent upload to restore access.

---

### REQ-029: System Timezone

**As the** system, **I want to** operate in Eastern Time for all time-based validations, **so that** school hours and night work rules are applied consistently.

**Acceptance Criteria:**

1. THE System SHALL use America/New_York timezone for all time-based rules.
2. THE System SHALL display times in Eastern Time to all users.
3. THE System SHALL store timestamps in UTC with Eastern Time display.
