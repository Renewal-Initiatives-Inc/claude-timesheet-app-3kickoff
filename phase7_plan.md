# Phase 7: Compliance Rule Engine - Execution Plan

## Overview

**Goal**: Implement all 37 compliance rules with clear error messaging, creating a robust rule engine that blocks non-compliant timesheet submissions while providing actionable guidance.

**Deliverable**: Full compliance engine that:
- Evaluates rules per-day based on employee's age on that specific date
- Logs all compliance check results for audit trail
- Returns clear, actionable error messages with remediation guidance
- Only allows submission when all rules pass

---

## Pre-Implementation Verification

### Dependencies from Previous Phases (Verify Complete)

- [x] **Phase 2**: Database schema with `complianceCheckLogs` table
- [x] **Phase 3**: Authentication and employee session context
- [x] **Phase 4**: Employee documents (parental_consent, work_permit, safety_training)
- [x] **Phase 5**: Task codes with compliance attributes (minAgeAllowed, supervisorRequired, hazardous flags)
- [x] **Phase 6**: Timesheet entries with all required fields (isSchoolDay, mealBreakConfirmed, supervisorPresentName)

### Existing Infrastructure to Leverage

| Component | Location | Purpose |
|-----------|----------|---------|
| Age calculation | `utils/age.ts` | `calculateAge(dob, asOfDate)`, `getWeeklyAges()` |
| School day detection | `utils/timezone.ts` | `isDefaultSchoolDay()`, `isWithinSchoolHours()` |
| Hour limits | `timesheet-entry.service.ts` | Constants for each age band |
| Compliance log schema | `db/schema/compliance.ts` | `complianceCheckLogs` table |
| Document service | `employee.service.ts` | Document verification functions |

---

## Rule Categories and Implementation

### Category 1: Documentation Rules (5 rules)

| Rule ID | Description | Age Band | Validation |
|---------|-------------|----------|------------|
| RULE-001 | Parental consent required | <18 | Check `employeeDocuments` for valid `parental_consent` |
| RULE-006 | Parental consent with COPPA disclosure | 12-13 | Same as RULE-001 (COPPA in document itself) |
| RULE-007 | Parental consent not revoked | <18 | Check `invalidatedAt` is null |
| RULE-027 | Work permit required | 14-17 | Check `employeeDocuments` for valid `work_permit` |
| RULE-028 | Work permit not expired | 14-17 | Check `expiresAt` > current date |
| RULE-030 | Safety training complete | <18 | Check for `safety_training` document |

### Category 2: Hour Limit Rules (9 rules)

| Rule ID | Description | Age Band | Limit |
|---------|-------------|----------|-------|
| RULE-002 | Daily hour limit | 12-13 | 4 hours/day |
| RULE-003 | Weekly hour limit | 12-13 | 24 hours/week |
| RULE-008 | Daily hour limit (school day) | 14-15 | 3 hours |
| RULE-009 | Weekly hour limit (school week) | 14-15 | 18 hours |
| RULE-014 | Daily hour limit | 16-17 | 9 hours |
| RULE-015 | Weekly hour limit | 16-17 | 48 hours |
| RULE-018 | Day count limit | 16-17 | 6 days max |
| RULE-032 | Daily limit (non-school day) | 14-15 | 8 hours |
| RULE-033 | Weekly limit (non-school week) | 14-15 | 40 hours |

### Category 3: Time Window Rules (8 rules)

| Rule ID | Description | Age Band | Window |
|---------|-------------|----------|--------|
| RULE-004 | No school hours work | 12-13 | Not between 7 AM - 3 PM on school days |
| RULE-010 | No school hours work | 14-15 | Not between 7 AM - 3 PM on school days |
| RULE-011 | Work window restriction | 14-15 | 7 AM - 7 PM (9 PM Jun 1 - Labor Day) |
| RULE-016 | Work window restriction | 16-17 | 6 AM - 10 PM school nights |
| RULE-017 | Work window restriction | 16-17 | 6 AM - 11:30 PM non-school nights |
| RULE-034 | No school hours work | 16-17 | Not between 7 AM - 3 PM on school days |
| RULE-036 | School hours prohibition | all <18 | Master rule: no work 7 AM - 3 PM on school days |

### Category 4: Task Restriction Rules (8 rules)

| Rule ID | Description | Age Band | Restriction |
|---------|-------------|----------|-------------|
| RULE-005 | Task age restriction | 12-13 | Only tasks with `minAgeAllowed` <= 12 |
| RULE-012 | Task age restriction | 14-15 | Only tasks with `minAgeAllowed` <= 14 |
| RULE-019 | Task age restriction | 16-17 | Only tasks with `minAgeAllowed` <= 16 |
| RULE-024 | Hazardous task prohibition | <18 | No tasks with `isHazardous = true` |
| RULE-020 | Power machinery prohibition | <18 | No tasks with `powerMachinery = true` |
| RULE-021 | Driving prohibition | <18 | No tasks with `drivingRequired = true` |
| RULE-022 | Solo cash handling | <14 | No tasks with `soloCashHandling = true` |
| RULE-029 | Supervisor attestation | <18 | Tasks with `supervisorRequired` need name recorded |

### Category 5: Break Requirements (2 rules)

| Rule ID | Description | Age Band | Requirement |
|---------|-------------|----------|-------------|
| RULE-025 | Meal break required | <18 | 30-min break if >6 hours worked |
| RULE-026 | Meal break confirmed | <18 | `mealBreakConfirmed` must be true when applicable |

### Category 6: Meta Rules (3 rules)

| Rule ID | Description | Implementation |
|---------|-------------|----------------|
| RULE-031 | Age per work date | Apply rules based on age ON that specific date |
| RULE-035 | Audit logging | Log ALL compliance checks to `complianceCheckLogs` |
| RULE-037 | School day defaulting | Mon-Fri during Aug 28 - Jun 20 are school days by default |

---

## Implementation Tasks

### Task 1: Rule Engine Architecture

**Files to Create:**
- `packages/backend/src/services/compliance/index.ts` - Main service entry point
- `packages/backend/src/services/compliance/types.ts` - Types and interfaces
- `packages/backend/src/services/compliance/rules/` - Directory for rule implementations
- `packages/backend/src/services/compliance/engine.ts` - Rule execution engine

**Architecture:**

```typescript
// types.ts
interface ComplianceRule {
  id: string;                    // e.g., "RULE-002"
  name: string;                  // Human-readable name
  category: RuleCategory;        // documentation | hours | time_window | task | break | meta
  appliesToAgeBands: AgeBand[];  // Which age bands this rule applies to
  evaluate: (context: ComplianceContext) => RuleResult;
}

interface ComplianceContext {
  employee: Employee;
  timesheet: TimesheetWithEntries;
  entries: TimesheetEntryWithTaskCode[];
  documents: EmployeeDocument[];
  // Pre-computed per-day data
  dailyAges: Map<string, number>;      // date -> age on that date
  dailyHours: Map<string, number>;     // date -> total hours
  dailyEntries: Map<string, Entry[]>;  // date -> entries for that day
  weeklyTotal: number;
  workDaysCount: number;
  schoolDaysInWeek: string[];
  isSchoolWeek: boolean;
}

interface RuleResult {
  ruleId: string;
  result: 'pass' | 'fail' | 'not_applicable';
  details: {
    ruleDescription: string;
    checkedValues?: Record<string, any>;
    threshold?: number | string;
    actualValue?: number | string;
    affectedDates?: string[];
    affectedEntries?: string[];  // entry IDs
  };
  errorMessage?: string;        // User-facing message
  remediationGuidance?: string; // How to fix
}
```

**Deliverables:**
- Pluggable rule registration system
- Context preparation from timesheet data
- Per-day age calculation integration
- Rule execution with short-circuit option (fail-fast) or full evaluation
- Result aggregation

---

### Task 2: Documentation Rules Implementation

**File:** `packages/backend/src/services/compliance/rules/documentation.rules.ts`

**Rules to Implement:**

```typescript
// RULE-001, RULE-006, RULE-007: Parental Consent
export const parentalConsentRule: ComplianceRule = {
  id: 'RULE-001',
  name: 'Parental Consent Required',
  category: 'documentation',
  appliesToAgeBands: ['12-13', '14-15', '16-17'],
  evaluate: (ctx) => {
    // Check for valid parental_consent document
    // Check invalidatedAt is null
    // Return pass/fail with guidance
  }
};

// RULE-027, RULE-028: Work Permit
export const workPermitRule: ComplianceRule = {
  id: 'RULE-027',
  name: 'Work Permit Required',
  category: 'documentation',
  appliesToAgeBands: ['14-15', '16-17'],
  evaluate: (ctx) => {
    // Check for work_permit document
    // Check expiresAt > current date
  }
};

// RULE-030: Safety Training
export const safetyTrainingRule: ComplianceRule = {
  id: 'RULE-030',
  name: 'Safety Training Required',
  category: 'documentation',
  appliesToAgeBands: ['12-13', '14-15', '16-17'],
  evaluate: (ctx) => {
    // Check for safety_training document
  }
};
```

---

### Task 3: Hour Limit Rules Implementation

**File:** `packages/backend/src/services/compliance/rules/hour-limits.rules.ts`

**Key Logic:**

```typescript
// Age 12-13 limits
const LIMITS_12_13 = { daily: 4, weekly: 24 };

// Age 14-15 limits (school vs non-school)
const LIMITS_14_15_SCHOOL = { daily: 3, weekly: 18 };
const LIMITS_14_15_NONSCHOOL = { daily: 8, weekly: 40 };

// Age 16-17 limits
const LIMITS_16_17 = { daily: 9, weekly: 48, maxDays: 6 };

// RULE-002: 12-13 daily limit
export const dailyLimit12_13Rule: ComplianceRule = {
  id: 'RULE-002',
  evaluate: (ctx) => {
    // For each day where employee was age 12-13
    // Check dailyHours[date] <= 4
    // Report ALL violations, not just first
  }
};

// RULE-008/009: 14-15 school limits
// Tricky: need to check if it's a school week (any school day in week)
// Apply school limits if isSchoolWeek
```

**Edge Cases:**
- Birthday mid-week: different limits apply to different days
- Week with mixed school/non-school days (use most restrictive)
- Total hours across age transition

---

### Task 4: Time Window Rules Implementation

**File:** `packages/backend/src/services/compliance/rules/time-window.rules.ts`

**Key Logic:**

```typescript
// School hours: 7:00 AM - 3:00 PM
const SCHOOL_HOURS_START = '07:00';
const SCHOOL_HOURS_END = '15:00';

// Age 14-15 work windows
const WINDOW_14_15_REGULAR = { start: '07:00', end: '19:00' }; // 7 AM - 7 PM
const WINDOW_14_15_SUMMER = { start: '07:00', end: '21:00' };  // 7 AM - 9 PM

// Age 16-17 work windows
const WINDOW_16_17_SCHOOL_NIGHT = { start: '06:00', end: '22:00' };    // 6 AM - 10 PM
const WINDOW_16_17_NONSCHOOL_NIGHT = { start: '06:00', end: '23:30' }; // 6 AM - 11:30 PM

// Determine if date is during summer (Jun 1 - Labor Day)
function isSummerPeriod(date: string): boolean {
  // Jun 1 through first Monday of September
}

// Check if entry violates time window
function checkTimeWindow(entry: Entry, window: TimeWindow, schoolDay: boolean): RuleResult {
  const { startTime, endTime } = entry;
  // Parse times to minutes
  // Check against window bounds
  // Special handling for school day + school hours
}
```

---

### Task 5: Task Restriction Rules Implementation

**File:** `packages/backend/src/services/compliance/rules/task-restrictions.rules.ts`

**Key Logic:**

```typescript
// RULE-005/012/019: Age-based task restrictions
export const taskAgeRestrictionRule: ComplianceRule = {
  id: 'RULE-005',
  evaluate: (ctx) => {
    // For each entry
    // Get employee age on entry.workDate
    // Check taskCode.minAgeAllowed <= age
    // Return violations with specific task codes
  }
};

// RULE-024: Hazardous prohibition
export const hazardousTaskRule: ComplianceRule = {
  id: 'RULE-024',
  appliesToAgeBands: ['12-13', '14-15', '16-17'],
  evaluate: (ctx) => {
    // Check no entries have taskCode.isHazardous === true
  }
};

// RULE-029: Supervisor attestation
export const supervisorAttestationRule: ComplianceRule = {
  id: 'RULE-029',
  evaluate: (ctx) => {
    // For entries where taskCode.supervisorRequired !== 'none'
    // AND employee age < 18
    // Check supervisorPresentName is not empty
  }
};
```

---

### Task 6: Break Requirement Rules Implementation

**File:** `packages/backend/src/services/compliance/rules/break-rules.ts`

**Key Logic:**

```typescript
// RULE-025, RULE-026: Meal break for >6 hour days
export const mealBreakRule: ComplianceRule = {
  id: 'RULE-025',
  appliesToAgeBands: ['12-13', '14-15', '16-17'],
  evaluate: (ctx) => {
    // For each day where employee <18 and totalHours > 6
    // Check mealBreakConfirmed === true for at least one entry
    // Return violations with specific dates
  }
};
```

---

### Task 7: Compliance Service Integration

**File:** `packages/backend/src/services/compliance/index.ts`

**Main Service:**

```typescript
import { ComplianceRule, ComplianceContext, RuleResult } from './types';
import { documentationRules } from './rules/documentation.rules';
import { hourLimitRules } from './rules/hour-limits.rules';
import { timeWindowRules } from './rules/time-window.rules';
import { taskRestrictionRules } from './rules/task-restrictions.rules';
import { breakRules } from './rules/break-rules';

// Register all rules
const allRules: ComplianceRule[] = [
  ...documentationRules,
  ...hourLimitRules,
  ...timeWindowRules,
  ...taskRestrictionRules,
  ...breakRules,
];

export class ComplianceService {
  /**
   * Run all compliance checks for a timesheet
   */
  async checkCompliance(
    timesheetId: string,
    options?: { stopOnFirstFailure?: boolean }
  ): Promise<ComplianceCheckResult> {
    // 1. Build context (fetch timesheet, entries, employee, documents)
    const context = await this.buildContext(timesheetId);

    // 2. Determine applicable rules based on employee age bands in this period
    const applicableRules = this.filterApplicableRules(context);

    // 3. Execute each rule
    const results: RuleResult[] = [];
    for (const rule of applicableRules) {
      const result = rule.evaluate(context);
      results.push(result);

      if (options?.stopOnFirstFailure && result.result === 'fail') {
        break;
      }
    }

    // 4. Log ALL results to complianceCheckLogs
    await this.logResults(timesheetId, results, context);

    // 5. Return aggregated result
    return {
      passed: results.every(r => r.result !== 'fail'),
      results,
      failedRules: results.filter(r => r.result === 'fail'),
      errorMessages: this.formatErrorMessages(results),
    };
  }

  /**
   * Build compliance context from timesheet data
   */
  private async buildContext(timesheetId: string): Promise<ComplianceContext> {
    // Fetch timesheet with entries
    // Fetch employee with documents
    // Compute daily ages using getWeeklyAges()
    // Compute daily hours totals
    // Determine school days and school week status
  }

  /**
   * Log compliance check results for audit
   */
  private async logResults(
    timesheetId: string,
    results: RuleResult[],
    context: ComplianceContext
  ): Promise<void> {
    // Insert into complianceCheckLogs table
    // Include: ruleId, result, details (JSONB), employeeAgeOnDate
  }

  /**
   * Format user-friendly error messages
   */
  private formatErrorMessages(results: RuleResult[]): string[] {
    return results
      .filter(r => r.result === 'fail')
      .map(r => `${r.errorMessage}\n${r.remediationGuidance}`);
  }
}
```

---

### Task 8: Submit Endpoint Implementation

**File:** `packages/backend/src/routes/timesheets.ts` (update)

**Current Placeholder:**
```typescript
// POST /api/timesheets/:id/submit
// Currently just changes status without compliance check
```

**Updated Implementation:**

```typescript
router.post('/:id/submit', authenticate, async (req, res) => {
  const { id } = req.params;
  const employeeId = req.user!.employeeId;

  try {
    // 1. Verify ownership and editability
    const timesheet = await timesheetService.getTimesheetById(id);
    if (!timesheet) {
      return res.status(404).json({ error: 'Timesheet not found' });
    }
    if (timesheet.employeeId !== employeeId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (timesheet.status !== 'open') {
      return res.status(400).json({ error: 'Timesheet already submitted' });
    }

    // 2. Run compliance checks
    const complianceResult = await complianceService.checkCompliance(id);

    // 3. Return result based on pass/fail
    if (!complianceResult.passed) {
      // Return detailed errors without changing status
      return res.status(400).json({
        error: 'Compliance check failed',
        passed: false,
        violations: complianceResult.failedRules.map(r => ({
          ruleId: r.ruleId,
          message: r.errorMessage,
          remediation: r.remediationGuidance,
          affectedDates: r.details.affectedDates,
          affectedEntries: r.details.affectedEntries,
        })),
      });
    }

    // 4. All checks passed - update status to submitted
    await timesheetService.submitTimesheet(id);

    return res.json({
      passed: true,
      message: 'Timesheet submitted successfully',
      status: 'submitted',
    });

  } catch (error) {
    console.error('Submit error:', error);
    return res.status(500).json({ error: 'Failed to submit timesheet' });
  }
});
```

---

### Task 9: Error Message Design

**File:** `packages/backend/src/services/compliance/messages.ts`

**Message Templates:**

```typescript
export const errorMessages = {
  // Documentation
  RULE_001: {
    message: (employeeName: string) =>
      `Parental consent required: ${employeeName} is under 18 and requires a valid parental consent form on file.`,
    remediation: 'Please contact your supervisor to upload the parental consent form before submitting your timesheet.',
  },

  RULE_027: {
    message: (age: number) =>
      `Work permit required: Massachusetts law requires a Youth Employment Permit for workers ages 14-17.`,
    remediation: 'Please obtain a work permit from your school and have your supervisor upload it before submitting.',
  },

  // Hour limits
  RULE_002: {
    message: (date: string, hours: number) =>
      `Daily hour limit exceeded: Ages 12-13 may work maximum 4 hours per day. You entered ${hours} hours on ${date}.`,
    remediation: 'Please reduce hours to 4.0 or less for that day.',
  },

  RULE_008: {
    message: (date: string, hours: number) =>
      `School day hour limit exceeded: Ages 14-15 may work maximum 3 hours on school days. You entered ${hours} hours on ${date}.`,
    remediation: 'Please reduce hours to 3.0 or less, or verify this is not a school day.',
  },

  // Time windows
  RULE_004: {
    message: (date: string, time: string) =>
      `School hours violation: You logged work at ${time} on ${date}, which falls within school hours (7:00 AM - 3:00 PM). Ages 12-13 cannot work during school hours on school days.`,
    remediation: 'Please adjust start/end times to be outside 7:00 AM - 3:00 PM, or mark this as a non-school day with a note.',
  },

  // Tasks
  RULE_024: {
    message: (taskCode: string, taskName: string) =>
      `Hazardous task restriction: Task ${taskCode} (${taskName}) is classified as hazardous and prohibited for workers under 18.`,
    remediation: 'Please remove this task from your timesheet or speak with your supervisor about reassignment.',
  },

  // Breaks
  RULE_025: {
    message: (date: string, hours: number) =>
      `Meal break required: You worked ${hours} hours on ${date}. Workers under 18 must take a 30-minute meal break when working more than 6 hours.`,
    remediation: 'Please confirm that you took a 30-minute meal break by checking the meal break confirmation box.',
  },
};
```

---

### Task 10: Frontend Error Display

**File:** `packages/frontend/src/pages/Timesheet.tsx` (update)

**Add Error Handling:**

```typescript
// State for compliance errors
const [complianceErrors, setComplianceErrors] = useState<ComplianceViolation[]>([]);

// Submit handler
const handleSubmit = async () => {
  setComplianceErrors([]);
  try {
    const response = await api.post(`/api/timesheets/${timesheetId}/submit`);
    if (response.data.passed) {
      // Success - navigate or show success message
    }
  } catch (error) {
    if (error.response?.status === 400 && error.response.data.violations) {
      setComplianceErrors(error.response.data.violations);
    } else {
      // Handle other errors
    }
  }
};

// Render errors
{complianceErrors.length > 0 && (
  <ComplianceErrorDisplay
    errors={complianceErrors}
    onEntryClick={(entryId) => scrollToEntry(entryId)}
  />
)}
```

**File:** `packages/frontend/src/components/ComplianceErrorDisplay.tsx` (new)

```typescript
interface ComplianceViolation {
  ruleId: string;
  message: string;
  remediation: string;
  affectedDates?: string[];
  affectedEntries?: string[];
}

export function ComplianceErrorDisplay({ errors, onEntryClick }: Props) {
  return (
    <div className="compliance-errors" role="alert">
      <h3>Compliance Check Failed</h3>
      <p>Please fix the following issues before resubmitting:</p>
      <ul>
        {errors.map((error, i) => (
          <li key={i} className="compliance-error">
            <strong>{error.ruleId}:</strong> {error.message}
            <div className="remediation">{error.remediation}</div>
            {error.affectedDates && (
              <div className="affected">
                Affected dates: {error.affectedDates.join(', ')}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## Testing Plan

### Unit Tests for Each Rule

**File:** `packages/backend/src/services/compliance/__tests__/`

#### Documentation Rules Tests
```typescript
// documentation.rules.test.ts
describe('RULE-001: Parental Consent', () => {
  it('passes when valid consent exists for minor', async () => {});
  it('fails when no consent for minor', async () => {});
  it('fails when consent is invalidated (revoked)', async () => {});
  it('returns not_applicable for adult (18+)', async () => {});
});

describe('RULE-027: Work Permit', () => {
  it('passes when valid permit exists for ages 14-17', async () => {});
  it('fails when no permit for age 14', async () => {});
  it('fails when permit is expired', async () => {});
  it('returns not_applicable for ages 12-13', async () => {});
  it('returns not_applicable for age 18+', async () => {});
});
```

#### Hour Limit Tests
```typescript
// hour-limits.rules.test.ts
describe('RULE-002: Age 12-13 Daily Limit', () => {
  it('passes when daily hours <= 4', async () => {});
  it('fails when daily hours > 4', async () => {});
  it('fails when exactly 4.01 hours (boundary)', async () => {});
  it('checks each day independently', async () => {});
  it('only applies to days when employee was 12-13', async () => {});
});

describe('RULE-008: Age 14-15 School Day Limit', () => {
  it('passes when school day hours <= 3', async () => {});
  it('fails when school day hours > 3', async () => {});
  it('applies 8-hour limit on non-school days', async () => {});
  it('treats overridden non-school days correctly', async () => {});
});

describe('Birthday Mid-Week', () => {
  it('applies 12-13 rules before 14th birthday', async () => {});
  it('applies 14-15 rules from 14th birthday onward', async () => {});
  it('handles week spanning 14th birthday', async () => {});
  it('handles week spanning 18th birthday', async () => {});
});
```

#### Time Window Tests
```typescript
// time-window.rules.test.ts
describe('RULE-004: School Hours (12-13)', () => {
  it('passes when work outside 7 AM - 3 PM', async () => {});
  it('fails when start time within school hours', async () => {});
  it('fails when end time within school hours', async () => {});
  it('fails when work spans school hours', async () => {});
  it('only applies on school days', async () => {});
});

describe('RULE-011: Age 14-15 Work Window', () => {
  it('passes for work 7 AM - 7 PM (regular)', async () => {});
  it('fails for work ending at 8 PM (regular)', async () => {});
  it('passes for work ending at 9 PM (summer)', async () => {});
  it('correctly identifies summer period (Jun 1 - Labor Day)', async () => {});
});

describe('RULE-016/017: Age 16-17 Work Window', () => {
  it('applies 10 PM limit on school nights', async () => {});
  it('applies 11:30 PM limit on non-school nights', async () => {});
  it('school night = night before school day', async () => {});
});
```

#### Task Restriction Tests
```typescript
// task-restrictions.rules.test.ts
describe('RULE-024: Hazardous Tasks', () => {
  it('passes when no hazardous tasks for minor', async () => {});
  it('fails when hazardous task selected by minor', async () => {});
  it('allows hazardous tasks for adults', async () => {});
});

describe('RULE-029: Supervisor Attestation', () => {
  it('passes when supervisor name provided', async () => {});
  it('fails when supervisor name missing', async () => {});
  it('only required for supervisor_required tasks', async () => {});
});
```

#### Break Requirement Tests
```typescript
// break-rules.test.ts
describe('RULE-025: Meal Break', () => {
  it('passes when break confirmed for >6 hour day', async () => {});
  it('fails when break not confirmed for >6 hour day', async () => {});
  it('not required for days <= 6 hours', async () => {});
  it('only applies to minors', async () => {});
});
```

### Integration Tests

**File:** `packages/backend/src/routes/__tests__/timesheets.submit.test.ts`

```typescript
describe('POST /api/timesheets/:id/submit', () => {
  it('returns 400 with violations when compliance fails', async () => {});
  it('returns 200 and changes status when all rules pass', async () => {});
  it('logs all compliance checks to database', async () => {});
  it('returns multiple violations when multiple rules fail', async () => {});
  it('prevents submission of already-submitted timesheet', async () => {});
});
```

### E2E Tests

**File:** `packages/e2e/tests/compliance-submission.spec.ts`

```typescript
describe('Timesheet Compliance Submission', () => {
  test('employee can submit compliant timesheet', async ({ page }) => {
    // Login as 16-year-old with all documents
    // Create entries within limits
    // Submit successfully
  });

  test('shows clear errors for hour limit violation', async ({ page }) => {
    // Login as 12-year-old
    // Enter 5 hours for one day
    // Attempt submit
    // Verify error message displayed
    // Verify affected day highlighted
  });

  test('shows error for missing documentation', async ({ page }) => {
    // Login as 14-year-old without work permit
    // Attempt submit
    // Verify documentation error shown
  });

  test('handles birthday mid-week correctly', async ({ page }) => {
    // Use test employee with birthday this week
    // Enter different hours before/after birthday
    // Verify correct rules applied to each day
  });
});
```

---

## Files Summary

### New Files to Create

| File | Purpose |
|------|---------|
| `packages/backend/src/services/compliance/index.ts` | Main compliance service |
| `packages/backend/src/services/compliance/types.ts` | TypeScript interfaces |
| `packages/backend/src/services/compliance/engine.ts` | Rule execution engine |
| `packages/backend/src/services/compliance/messages.ts` | Error message templates |
| `packages/backend/src/services/compliance/rules/documentation.rules.ts` | Documentation rules |
| `packages/backend/src/services/compliance/rules/hour-limits.rules.ts` | Hour limit rules |
| `packages/backend/src/services/compliance/rules/time-window.rules.ts` | Time window rules |
| `packages/backend/src/services/compliance/rules/task-restrictions.rules.ts` | Task restriction rules |
| `packages/backend/src/services/compliance/rules/break-rules.ts` | Break requirement rules |
| `packages/backend/src/services/compliance/__tests__/*.test.ts` | Unit tests for each rule |
| `packages/frontend/src/components/ComplianceErrorDisplay.tsx` | Error display component |
| `packages/e2e/tests/compliance-submission.spec.ts` | E2E tests |

### Files to Modify

| File | Changes |
|------|---------|
| `packages/backend/src/routes/timesheets.ts` | Update submit endpoint |
| `packages/frontend/src/pages/Timesheet.tsx` | Add error handling and display |

---

## Acceptance Criteria Mapping

| Requirement | Criteria | Implementation |
|-------------|----------|----------------|
| REQ-006 | Daily/weekly limits for 12-13 | RULE-002, RULE-003 |
| REQ-007 | Daily/weekly limits for 14-15 | RULE-008, RULE-009, RULE-032, RULE-033 |
| REQ-008 | Daily/weekly/day limits for 16-17 | RULE-014, RULE-015, RULE-018 |
| REQ-009 | Hazardous task restrictions | RULE-024, RULE-020, RULE-021, RULE-022 |
| REQ-011 | Compliance check on submission | Submit endpoint integration |
| REQ-013 | Meal break verification | RULE-025, RULE-026 |
| REQ-020 | Birthday mid-period handling | RULE-031, age calculation |
| REQ-021 | Most-restrictive law resolution | School week detection, window logic |
| REQ-022 | Audit logging | ComplianceCheckLog writes |

---

## Implementation Order

1. **Types and Architecture** (Task 1)
   - Define interfaces
   - Create rule registration system

2. **Core Engine** (Task 7 partial)
   - Build context preparation
   - Implement rule execution loop
   - Add logging to database

3. **Documentation Rules** (Task 2)
   - Simplest rules to validate architecture

4. **Hour Limit Rules** (Task 3)
   - Most complex logic with birthday handling

5. **Time Window Rules** (Task 4)
   - Summer period and school night logic

6. **Task Restriction Rules** (Task 5)
   - Age-based and attribute-based checks

7. **Break Rules** (Task 6)
   - Simple daily check

8. **Error Messages** (Task 9)
   - User-friendly formatting

9. **Submit Endpoint** (Task 8)
   - Integration point

10. **Frontend Display** (Task 10)
    - Error rendering

11. **Testing** (throughout)
    - Unit tests per rule
    - Integration tests
    - E2E tests

---

## Estimated Complexity

| Task | Complexity | Notes |
|------|------------|-------|
| Architecture | Medium | Core foundation |
| Documentation Rules | Low | Simple document checks |
| Hour Limits | High | Birthday transitions, school week logic |
| Time Windows | High | Summer periods, school night detection |
| Task Restrictions | Medium | Age filtering already exists |
| Break Rules | Low | Simple >6 hour check |
| Error Messages | Medium | User experience critical |
| Submit Integration | Medium | Tying it all together |
| Frontend Display | Low | Display only |
| Testing | High | 37 rules × multiple edge cases |

---

## Risk Mitigation

1. **Birthday Edge Cases**
   - Test: 14th birthday on Sunday (start of week)
   - Test: 18th birthday on Saturday (end of week)
   - Test: Multiple birthdays in test data

2. **School Day Complexity**
   - Test: Week with mixed school/non-school days
   - Test: Override notes required
   - Test: Summer vs school year transition

3. **Time Zone Issues**
   - All time comparisons in Eastern Time
   - Use existing `utils/timezone.ts` functions

4. **Performance**
   - Target: <5 seconds for full compliance check
   - Profile with 7 days × 5 entries per day
   - Index `complianceCheckLogs` by `timesheetId`

---

## Success Criteria (Before Moving to Phase 8)

- [ ] All 37 compliance rules implemented and tested
- [ ] Unit tests pass for all rules including edge cases
- [ ] Birthday mid-week handling verified
- [ ] Compliance check completes in <5 seconds
- [ ] Error messages provide actionable remediation
- [ ] All compliance results logged to database
- [ ] Submit endpoint blocks non-compliant timesheets
- [ ] Frontend displays errors clearly
- [ ] E2E tests pass for submission flow
