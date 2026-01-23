# Phase 6: Timesheet Entry Interface - Detailed Execution Plan

## Overview

**Goal**: Build the employee timesheet entry experience with real-time feedback.

**Deliverable**: Employees can enter time with real-time feedback on limits.

This phase creates the core user-facing timesheet entry system. Employees will be able to select work weeks, enter time against task codes, and see running totals before submission. The UI must accommodate ages 12-17 with appropriate guidance and restrictions.

---

## Prerequisites Verification

Before starting Phase 6, verify these Phase 1-5 deliverables are complete:

### Database Schema (Phase 2)
- [ ] `timesheets` table exists with correct schema
- [ ] `timesheet_entries` table exists with correct schema
- [ ] Foreign key relationships to `employees` and `task_codes` are in place

### Authentication (Phase 3)
- [ ] `requireAuth` middleware functioning
- [ ] JWT token verification working
- [ ] `req.employee` populated with authenticated user

### Employee Management (Phase 4)
- [ ] Employee CRUD API working
- [ ] Documentation status checks available
- [ ] Age calculation utilities (`calculateAge`, `getWeeklyAges`) tested

### Task Code Management (Phase 5)
- [ ] Task codes created with compliance attributes
- [ ] `GET /api/task-codes/for-employee/:id` endpoint filters by age
- [ ] Rate versioning working with effective dates

---

## Requirements Satisfied

This phase addresses the following requirements from requirements.md:

| Requirement | Title | Coverage |
|------------|-------|----------|
| REQ-004 | Task Code Time Entry | Full |
| REQ-005 | School Day Tracking | Full |
| REQ-010 | Supervisor Attestation for Flagged Tasks | Full |
| REQ-013 | Meal Break Verification | Full |
| REQ-019 | Weekly Timesheet Selection | Full |
| REQ-020 | Birthday Mid-Period Rule Switching | Partial (UI awareness, full enforcement in Phase 7) |
| REQ-006 | Age 12-13 Hour Limits | Display only (enforcement in Phase 7) |
| REQ-007 | Age 14-15 Hour Limits | Display only (enforcement in Phase 7) |
| REQ-008 | Age 16-17 Hour Limits | Display only (enforcement in Phase 7) |

---

## Task Breakdown

### Task 6.1: Timesheet Service Layer

**Goal**: Create backend service for timesheet CRUD operations.

**Files to Create:**
- `packages/backend/src/services/timesheet.service.ts`

**Files to Modify:**
- `packages/backend/src/services/index.ts` (export new service)

**Implementation Details:**

```typescript
// timesheet.service.ts key functions:

// Create or get existing timesheet for employee + week
getOrCreateTimesheet(employeeId: string, weekStartDate: string): Promise<Timesheet>

// Get timesheet with all entries
getTimesheetWithEntries(timesheetId: string): Promise<TimesheetWithEntries>

// Get employee's timesheets (paginated, with status filter)
getEmployeeTimesheets(employeeId: string, options?: {
  status?: TimesheetStatus[];
  limit?: number;
  offset?: number;
}): Promise<{ timesheets: Timesheet[]; total: number }>

// Validate timesheet ownership
validateTimesheetAccess(timesheetId: string, employeeId: string): Promise<boolean>

// Check if timesheet is editable (status === 'open')
isTimesheetEditable(timesheet: Timesheet): boolean
```

**Error Cases:**
- `TIMESHEET_NOT_FOUND`: Timesheet ID doesn't exist
- `TIMESHEET_NOT_EDITABLE`: Status is not 'open'
- `TIMESHEET_ACCESS_DENIED`: Employee doesn't own timesheet

**Tests to Write:**
- `packages/backend/src/__tests__/services/timesheet.service.test.ts`
  - Test getOrCreate returns existing timesheet for same employee+week
  - Test getOrCreate creates new timesheet if none exists
  - Test access validation
  - Test editability checks

---

### Task 6.2: Timesheet Entry Service Layer

**Goal**: Create backend service for timesheet entry CRUD with business logic.

**Files to Create:**
- `packages/backend/src/services/timesheet-entry.service.ts`

**Files to Modify:**
- `packages/backend/src/services/index.ts`

**Implementation Details:**

```typescript
// timesheet-entry.service.ts key functions:

// Add entry to timesheet (with validation)
createEntry(timesheetId: string, entry: CreateEntryInput): Promise<TimesheetEntry>

// Update existing entry
updateEntry(entryId: string, updates: UpdateEntryInput): Promise<TimesheetEntry>

// Delete entry (only if timesheet is open)
deleteEntry(entryId: string): Promise<void>

// Calculate hours from start/end time
calculateHours(startTime: string, endTime: string): number

// Get daily totals for a timesheet
getDailyTotals(timesheetId: string): Promise<Map<string, number>>

// Get weekly total for a timesheet
getWeeklyTotal(timesheetId: string): Promise<number>

// Check if entry date is valid for the timesheet week
validateEntryDate(timesheetId: string, workDate: string): boolean

// Determine default school day status
getDefaultSchoolDayStatus(workDate: string): boolean

// Get all entries for a timesheet grouped by date
getEntriesGroupedByDate(timesheetId: string): Promise<Map<string, TimesheetEntry[]>>
```

**Business Rules Implemented:**
1. Hours calculation: `(endTime - startTime) / 60` in decimal hours
2. Default school day: Mon-Fri during Aug 28 - Jun 20
3. Entry must be within timesheet's week (Sun-Sat)
4. Can only modify entries when timesheet status is 'open'

**Error Cases:**
- `ENTRY_NOT_FOUND`: Entry ID doesn't exist
- `INVALID_TIME_RANGE`: endTime <= startTime
- `DATE_OUTSIDE_WEEK`: workDate not in timesheet's week
- `TIMESHEET_NOT_EDITABLE`: Timesheet status not 'open'
- `TASK_CODE_NOT_FOUND`: Referenced task code doesn't exist

**Tests to Write:**
- `packages/backend/src/__tests__/services/timesheet-entry.service.test.ts`
  - Test hours calculation (normal case, edge cases)
  - Test date validation (within week, outside week)
  - Test school day default calculation
  - Test CRUD operations
  - Test entry modification blocked when submitted

---

### Task 6.3: Timesheet Validation Schemas

**Goal**: Create Zod validation schemas for timesheet API requests.

**Files to Create:**
- `packages/backend/src/validation/timesheet.schema.ts`

**Implementation Details:**

```typescript
// timesheet.schema.ts

// Create/get timesheet request
export const getTimesheetSchema = z.object({
  weekStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')
    .refine(isValidSunday, 'Week start date must be a Sunday'),
});

// Create entry request
export const createEntrySchema = z.object({
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  taskCodeId: z.string().uuid(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
  isSchoolDay: z.boolean(),
  schoolDayOverrideNote: z.string().min(10).max(500).optional().nullable(),
  supervisorPresentName: z.string().min(2).max(100).optional().nullable(),
  mealBreakConfirmed: z.boolean().optional().nullable(),
}).refine(
  data => !data.isSchoolDay || !isDefaultSchoolDay(data.workDate) || !data.schoolDayOverrideNote,
  { message: 'Override note required when changing school day status', path: ['schoolDayOverrideNote'] }
);

// Update entry request
export const updateEntrySchema = z.object({
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  taskCodeId: z.string().uuid().optional(),
  isSchoolDay: z.boolean().optional(),
  schoolDayOverrideNote: z.string().min(10).max(500).optional().nullable(),
  supervisorPresentName: z.string().min(2).max(100).optional().nullable(),
  mealBreakConfirmed: z.boolean().optional().nullable(),
});

// List timesheets query
export const listTimesheetsQuerySchema = z.object({
  status: z.enum(['open', 'submitted', 'approved', 'rejected', 'all']).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});
```

**Tests to Write:**
- `packages/backend/src/__tests__/validation/timesheet.schema.test.ts`
  - Test date format validation
  - Test Sunday validation for week start
  - Test time format validation
  - Test school day override note requirement

---

### Task 6.4: Timesheet API Routes

**Goal**: Create REST API endpoints for timesheet operations.

**Files to Create:**
- `packages/backend/src/routes/timesheets.ts`

**Files to Modify:**
- `packages/backend/src/routes/index.ts` (register routes)

**Endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/timesheets` | Employee | List own timesheets |
| GET | `/api/timesheets/current` | Employee | Get/create current week timesheet |
| GET | `/api/timesheets/week/:weekStartDate` | Employee | Get/create timesheet for specific week |
| GET | `/api/timesheets/:id` | Employee | Get timesheet with entries |
| POST | `/api/timesheets/:id/entries` | Employee | Add entry to timesheet |
| PATCH | `/api/timesheets/:id/entries/:entryId` | Employee | Update entry |
| DELETE | `/api/timesheets/:id/entries/:entryId` | Employee | Delete entry |
| GET | `/api/timesheets/:id/totals` | Employee | Get daily and weekly totals |

**Implementation Pattern (following existing task-codes.ts pattern):**

```typescript
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { timesheetService, timesheetEntryService } from '../services/index.js';
import * as schemas from '../validation/timesheet.schema.js';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// GET /api/timesheets - List employee's timesheets
router.get('/', async (req, res, next) => {
  try {
    const query = schemas.listTimesheetsQuerySchema.parse(req.query);
    const result = await timesheetService.getEmployeeTimesheets(
      req.employee!.id,
      query
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/timesheets/current - Get current week
router.get('/current', async (req, res, next) => {
  try {
    const weekStart = getWeekStartDate(getTodayET());
    const timesheet = await timesheetService.getOrCreateTimesheet(
      req.employee!.id,
      weekStart
    );
    const withEntries = await timesheetService.getTimesheetWithEntries(timesheet.id);
    res.json(withEntries);
  } catch (error) {
    next(error);
  }
});

// ... additional routes following same pattern
```

**Access Control Rules:**
- Employees can only access their own timesheets
- Supervisor routes (review queue) will be added in Phase 8

**Tests to Write:**
- `packages/backend/src/__tests__/routes/timesheets.test.ts`
  - Test authentication required
  - Test ownership validation
  - Test CRUD operations
  - Test error cases (not found, not editable)
  - Test totals calculation

---

### Task 6.5: Shared Types for Timesheet API

**Goal**: Add TypeScript types for timesheet API requests/responses.

**Files to Modify:**
- `shared/types/src/api.ts`

**Types to Add:**

```typescript
// Timesheet API types

export interface TimesheetWithEntries extends Timesheet {
  entries: TimesheetEntryWithTaskCode[];
  totals: {
    daily: Record<string, number>; // { '2024-01-15': 4.5, ... }
    weekly: number;
  };
}

export interface TimesheetEntryWithTaskCode extends TimesheetEntry {
  taskCode: TaskCodeWithCurrentRate;
}

export interface CreateEntryRequest {
  workDate: string;
  taskCodeId: string;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  isSchoolDay: boolean;
  schoolDayOverrideNote?: string | null;
  supervisorPresentName?: string | null;
  mealBreakConfirmed?: boolean | null;
}

export interface UpdateEntryRequest {
  startTime?: string;
  endTime?: string;
  taskCodeId?: string;
  isSchoolDay?: boolean;
  schoolDayOverrideNote?: string | null;
  supervisorPresentName?: string | null;
  mealBreakConfirmed?: boolean | null;
}

export interface TimesheetTotals {
  daily: Record<string, number>;
  weekly: number;
  limits: {
    dailyLimit: number;
    weeklyLimit: number;
    daysWorkedLimit?: number; // For 16-17 age band
  };
  warnings: string[]; // Visual warnings when approaching limits
}

export interface WeekInfo {
  weekStartDate: string;
  weekEndDate: string;
  dates: Array<{
    date: string;
    dayOfWeek: string;
    isSchoolDay: boolean;
    employeeAge: number;
  }>;
  birthdayInWeek?: {
    date: string;
    newAge: number;
  };
}
```

---

### Task 6.6: Frontend API Client Updates

**Goal**: Add timesheet API methods to frontend client.

**Files to Modify:**
- `packages/frontend/src/api/client.ts`

**Methods to Add:**

```typescript
// Timesheet API methods

async getTimesheets(options?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ timesheets: Timesheet[]; total: number }> {
  const params = new URLSearchParams();
  if (options?.status) params.set('status', options.status);
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.offset) params.set('offset', String(options.offset));
  return this.get(`/timesheets?${params}`);
}

async getCurrentTimesheet(): Promise<TimesheetWithEntries> {
  return this.get('/timesheets/current');
}

async getTimesheet(weekStartDate: string): Promise<TimesheetWithEntries> {
  return this.get(`/timesheets/week/${weekStartDate}`);
}

async getTimesheetById(id: string): Promise<TimesheetWithEntries> {
  return this.get(`/timesheets/${id}`);
}

async createEntry(timesheetId: string, entry: CreateEntryRequest): Promise<TimesheetEntry> {
  return this.post(`/timesheets/${timesheetId}/entries`, entry);
}

async updateEntry(
  timesheetId: string,
  entryId: string,
  updates: UpdateEntryRequest
): Promise<TimesheetEntry> {
  return this.patch(`/timesheets/${timesheetId}/entries/${entryId}`, updates);
}

async deleteEntry(timesheetId: string, entryId: string): Promise<void> {
  return this.delete(`/timesheets/${timesheetId}/entries/${entryId}`);
}

async getTimesheetTotals(timesheetId: string): Promise<TimesheetTotals> {
  return this.get(`/timesheets/${timesheetId}/totals`);
}
```

---

### Task 6.7: useTimesheet Hook

**Goal**: Create React hook for timesheet state management.

**Files to Create:**
- `packages/frontend/src/hooks/useTimesheet.ts`

**Implementation:**

```typescript
// useTimesheet.ts

import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type {
  TimesheetWithEntries,
  CreateEntryRequest,
  UpdateEntryRequest,
  TimesheetTotals,
} from '@renewal/types';

interface UseTimesheetOptions {
  weekStartDate?: string; // If not provided, uses current week
}

export function useTimesheet(options: UseTimesheetOptions = {}) {
  const [timesheet, setTimesheet] = useState<TimesheetWithEntries | null>(null);
  const [totals, setTotals] = useState<TimesheetTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Fetch timesheet
  const fetchTimesheet = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = options.weekStartDate
        ? await api.getTimesheet(options.weekStartDate)
        : await api.getCurrentTimesheet();
      setTimesheet(result);
      // Totals included in response
      setTotals(result.totals);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load timesheet');
    } finally {
      setLoading(false);
    }
  }, [options.weekStartDate]);

  useEffect(() => {
    fetchTimesheet();
  }, [fetchTimesheet]);

  // Add entry
  const addEntry = useCallback(async (entry: CreateEntryRequest) => {
    if (!timesheet) return;
    setSaving(true);
    try {
      await api.createEntry(timesheet.id, entry);
      await fetchTimesheet(); // Refresh to get updated totals
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add entry');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [timesheet, fetchTimesheet]);

  // Update entry
  const updateEntry = useCallback(async (entryId: string, updates: UpdateEntryRequest) => {
    if (!timesheet) return;
    setSaving(true);
    try {
      await api.updateEntry(timesheet.id, entryId, updates);
      await fetchTimesheet();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update entry');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [timesheet, fetchTimesheet]);

  // Delete entry
  const deleteEntry = useCallback(async (entryId: string) => {
    if (!timesheet) return;
    setSaving(true);
    try {
      await api.deleteEntry(timesheet.id, entryId);
      await fetchTimesheet();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete entry');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [timesheet, fetchTimesheet]);

  return {
    timesheet,
    totals,
    loading,
    error,
    saving,
    addEntry,
    updateEntry,
    deleteEntry,
    refresh: fetchTimesheet,
  };
}
```

---

### Task 6.8: Week Selector Component

**Goal**: Create component for selecting work weeks.

**Files to Create:**
- `packages/frontend/src/components/WeekSelector.tsx`

**Features:**
- Show current week by default
- Navigate to previous/next weeks
- Display week date range (Sun - Sat)
- Visual indicator for weeks with entries
- Block future weeks (can't enter time for future)
- Past weeks show lock icon unless unlocked by supervisor

**Implementation Sketch:**

```tsx
// WeekSelector.tsx

interface WeekSelectorProps {
  selectedWeek: string; // ISO date of Sunday
  onWeekChange: (weekStartDate: string) => void;
  lockedWeeks?: string[]; // Weeks that are locked
}

export function WeekSelector({ selectedWeek, onWeekChange, lockedWeeks = [] }: WeekSelectorProps) {
  const currentWeek = getWeekStartDate(getTodayET());
  const isFuture = selectedWeek > currentWeek;
  const isLocked = lockedWeeks.includes(selectedWeek) && selectedWeek !== currentWeek;

  const goToPreviousWeek = () => {
    const prevSunday = addDays(new Date(selectedWeek), -7);
    onWeekChange(formatDate(prevSunday));
  };

  const goToNextWeek = () => {
    const nextSunday = addDays(new Date(selectedWeek), 7);
    if (nextSunday <= new Date(currentWeek)) {
      onWeekChange(formatDate(nextSunday));
    }
  };

  return (
    <div className="week-selector">
      <button onClick={goToPreviousWeek}>&larr; Previous</button>
      <div className="week-display">
        <span>{formatWeekRange(selectedWeek)}</span>
        {isLocked && <LockIcon />}
      </div>
      <button onClick={goToNextWeek} disabled={isFuture}>Next &rarr;</button>
    </div>
  );
}
```

---

### Task 6.9: Timesheet Grid Component

**Goal**: Create the main timesheet entry grid UI.

**Files to Create:**
- `packages/frontend/src/components/TimesheetGrid.tsx`

**Features:**
- 7-column grid (Sun-Sat)
- Each day shows:
  - Date and day name
  - School day indicator (checkbox with override capability)
  - List of entries for that day
  - "Add Entry" button
  - Daily total hours
- Bottom row shows weekly total
- Visual warnings when approaching limits
- Disabled state when timesheet is submitted/approved

**Component Structure:**

```tsx
// TimesheetGrid.tsx

interface TimesheetGridProps {
  timesheet: TimesheetWithEntries;
  totals: TimesheetTotals;
  employeeAge: number;
  onAddEntry: (date: string) => void;
  onEditEntry: (entryId: string) => void;
  onDeleteEntry: (entryId: string) => void;
  onSchoolDayToggle: (date: string, isSchoolDay: boolean, note?: string) => void;
  disabled?: boolean;
}

export function TimesheetGrid({
  timesheet,
  totals,
  employeeAge,
  onAddEntry,
  onEditEntry,
  onDeleteEntry,
  onSchoolDayToggle,
  disabled,
}: TimesheetGridProps) {
  const weekDates = getWeekDates(timesheet.weekStartDate);
  const entriesByDate = groupEntriesByDate(timesheet.entries);

  return (
    <div className="timesheet-grid">
      {/* Header row with day names */}
      <div className="grid-header">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="day-header">{day}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid-body">
        {weekDates.map(date => (
          <DayCell
            key={date}
            date={date}
            entries={entriesByDate.get(date) || []}
            dailyTotal={totals.daily[date] || 0}
            dailyLimit={totals.limits.dailyLimit}
            employeeAge={employeeAge}
            onAddEntry={() => onAddEntry(date)}
            onEditEntry={onEditEntry}
            onDeleteEntry={onDeleteEntry}
            onSchoolDayToggle={onSchoolDayToggle}
            disabled={disabled}
          />
        ))}
      </div>

      {/* Totals row */}
      <div className="grid-footer">
        <WeeklyTotalDisplay
          total={totals.weekly}
          limit={totals.limits.weeklyLimit}
          warnings={totals.warnings}
        />
      </div>
    </div>
  );
}
```

---

### Task 6.10: Day Cell Component

**Goal**: Create component for individual day cells in the grid.

**Files to Create:**
- `packages/frontend/src/components/DayCell.tsx`

**Features:**
- Date display with school day checkbox
- School day override with required note
- List of entries with edit/delete actions
- Running daily total
- Warning indicator when approaching limit
- "Add Entry" button

**Implementation Sketch:**

```tsx
// DayCell.tsx

interface DayCellProps {
  date: string;
  entries: TimesheetEntryWithTaskCode[];
  dailyTotal: number;
  dailyLimit: number;
  employeeAge: number;
  onAddEntry: () => void;
  onEditEntry: (entryId: string) => void;
  onDeleteEntry: (entryId: string) => void;
  onSchoolDayToggle: (date: string, isSchoolDay: boolean, note?: string) => void;
  disabled?: boolean;
}

export function DayCell({
  date,
  entries,
  dailyTotal,
  dailyLimit,
  employeeAge,
  onAddEntry,
  onEditEntry,
  onDeleteEntry,
  onSchoolDayToggle,
  disabled,
}: DayCellProps) {
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const isApproachingLimit = dailyTotal >= dailyLimit * 0.8;
  const isAtLimit = dailyTotal >= dailyLimit;
  const defaultSchoolDay = isDefaultSchoolDay(date);
  const currentSchoolDay = entries[0]?.isSchoolDay ?? defaultSchoolDay;

  return (
    <div className={cn('day-cell', {
      'approaching-limit': isApproachingLimit,
      'at-limit': isAtLimit,
    })}>
      <div className="day-header">
        <span className="date">{formatShortDate(date)}</span>
        {employeeAge < 18 && (
          <SchoolDayToggle
            isSchoolDay={currentSchoolDay}
            isDefault={currentSchoolDay === defaultSchoolDay}
            onChange={(value) => {
              if (value !== defaultSchoolDay) {
                setShowOverrideModal(true);
              } else {
                onSchoolDayToggle(date, value);
              }
            }}
            disabled={disabled}
          />
        )}
      </div>

      <div className="entries-list">
        {entries.map(entry => (
          <EntryRow
            key={entry.id}
            entry={entry}
            onEdit={() => onEditEntry(entry.id)}
            onDelete={() => onDeleteEntry(entry.id)}
            disabled={disabled}
          />
        ))}
      </div>

      {!disabled && (
        <button
          className="add-entry-btn"
          onClick={onAddEntry}
          disabled={isAtLimit}
        >
          + Add Entry
        </button>
      )}

      <div className="daily-total">
        {dailyTotal.toFixed(1)} / {dailyLimit} hrs
      </div>

      {showOverrideModal && (
        <SchoolDayOverrideModal
          date={date}
          onConfirm={(note) => {
            onSchoolDayToggle(date, !currentSchoolDay, note);
            setShowOverrideModal(false);
          }}
          onCancel={() => setShowOverrideModal(false)}
        />
      )}
    </div>
  );
}
```

---

### Task 6.11: Entry Form Modal

**Goal**: Create modal form for adding/editing timesheet entries.

**Files to Create:**
- `packages/frontend/src/components/EntryFormModal.tsx`

**Features:**
- Task code dropdown (filtered by age)
- Start time picker
- End time picker
- Auto-calculated hours display
- Supervisor name field (when task requires attestation)
- Meal break confirmation (when hours > 6)
- School day status (pre-populated)
- Validation feedback

**Implementation Sketch:**

```tsx
// EntryFormModal.tsx

interface EntryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (entry: CreateEntryRequest | UpdateEntryRequest) => Promise<void>;
  entry?: TimesheetEntryWithTaskCode; // If editing
  date: string;
  employeeId: string;
  employeeAge: number;
  isSchoolDay: boolean;
}

export function EntryFormModal({
  isOpen,
  onClose,
  onSubmit,
  entry,
  date,
  employeeId,
  employeeAge,
  isSchoolDay,
}: EntryFormModalProps) {
  const { taskCodes, loading: loadingTasks } = useTaskCodesForEmployee(employeeId);
  const [formData, setFormData] = useState<EntryFormData>({
    taskCodeId: entry?.taskCodeId || '',
    startTime: entry?.startTime || '',
    endTime: entry?.endTime || '',
    supervisorPresentName: entry?.supervisorPresentName || '',
    mealBreakConfirmed: entry?.mealBreakConfirmed ?? null,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const selectedTask = taskCodes.find(tc => tc.id === formData.taskCodeId);
  const calculatedHours = calculateDisplayHours(formData.startTime, formData.endTime);
  const needsSupervisorAttestation = selectedTask &&
    (selectedTask.supervisorRequired === 'always' ||
     (selectedTask.supervisorRequired === 'for_minors' && employeeAge < 18));
  const needsMealBreakConfirmation = calculatedHours > 6 && employeeAge < 18;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.taskCodeId) {
      newErrors.taskCodeId = 'Please select a task';
    }
    if (!formData.startTime) {
      newErrors.startTime = 'Start time is required';
    }
    if (!formData.endTime) {
      newErrors.endTime = 'End time is required';
    }
    if (formData.startTime && formData.endTime && formData.startTime >= formData.endTime) {
      newErrors.endTime = 'End time must be after start time';
    }
    if (needsSupervisorAttestation && !formData.supervisorPresentName?.trim()) {
      newErrors.supervisorPresentName = 'Supervisor name is required for this task';
    }
    if (needsMealBreakConfirmation && formData.mealBreakConfirmed === null) {
      newErrors.mealBreakConfirmed = 'Please confirm meal break was taken';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setSubmitting(true);
    try {
      await onSubmit({
        workDate: date,
        ...formData,
        isSchoolDay,
      });
      onClose();
    } catch (err) {
      setErrors({ submit: err instanceof Error ? err.message : 'Failed to save' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={entry ? 'Edit Entry' : 'Add Entry'}>
      <div className="entry-form">
        <div className="form-field">
          <label>Task</label>
          <TaskCodeSelect
            taskCodes={taskCodes}
            value={formData.taskCodeId}
            onChange={(id) => setFormData(prev => ({ ...prev, taskCodeId: id }))}
            loading={loadingTasks}
            error={errors.taskCodeId}
          />
        </div>

        <div className="form-row">
          <div className="form-field">
            <label>Start Time</label>
            <TimeInput
              value={formData.startTime}
              onChange={(time) => setFormData(prev => ({ ...prev, startTime: time }))}
              error={errors.startTime}
            />
          </div>
          <div className="form-field">
            <label>End Time</label>
            <TimeInput
              value={formData.endTime}
              onChange={(time) => setFormData(prev => ({ ...prev, endTime: time }))}
              error={errors.endTime}
            />
          </div>
        </div>

        <div className="calculated-hours">
          Hours: {calculatedHours.toFixed(2)}
        </div>

        {needsSupervisorAttestation && (
          <div className="form-field">
            <label>Supervisor Present</label>
            <input
              type="text"
              value={formData.supervisorPresentName || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, supervisorPresentName: e.target.value }))}
              placeholder="Name of supervising adult"
            />
            {errors.supervisorPresentName && (
              <span className="error">{errors.supervisorPresentName}</span>
            )}
          </div>
        )}

        {needsMealBreakConfirmation && (
          <div className="form-field">
            <label>
              <input
                type="checkbox"
                checked={formData.mealBreakConfirmed === true}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  mealBreakConfirmed: e.target.checked
                }))}
              />
              I confirm I took a 30-minute meal break
            </label>
            {errors.mealBreakConfirmed && (
              <span className="error">{errors.mealBreakConfirmed}</span>
            )}
          </div>
        )}

        <div className="form-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
```

---

### Task 6.12: Timesheet Page

**Goal**: Create the main timesheet entry page.

**Files to Create:**
- `packages/frontend/src/pages/Timesheet.tsx`

**Files to Modify:**
- `packages/frontend/src/App.tsx` (add routes)

**Features:**
- Week selector at top
- Timesheet grid
- Running totals display
- Visual warnings for approaching limits
- Documentation status check (block if incomplete)
- Birthday in week notification
- Read-only mode for submitted/approved timesheets
- Save indicator

**Routes to Add:**

```tsx
// In App.tsx routes:
<Route path="/timesheet" element={<Timesheet />} />
<Route path="/timesheet/:weekStartDate" element={<Timesheet />} />
```

**Page Implementation Sketch:**

```tsx
// Timesheet.tsx

export function Timesheet() {
  const { weekStartDate } = useParams<{ weekStartDate?: string }>();
  const navigate = useNavigate();
  const { employee } = useAuth();

  const {
    timesheet,
    totals,
    loading,
    error,
    saving,
    addEntry,
    updateEntry,
    deleteEntry,
    refresh,
  } = useTimesheet({ weekStartDate });

  const { data: docStatus, loading: docLoading } = useDocumentationStatus(employee?.id);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<string | null>(null);

  // Check documentation status
  if (!docLoading && docStatus && !docStatus.isComplete) {
    return (
      <div className="documentation-required">
        <h2>Documentation Required</h2>
        <p>You cannot submit timesheets until your documentation is complete.</p>
        <DocumentationStatus status={docStatus} />
        <p>Please contact your supervisor to upload the required documents.</p>
      </div>
    );
  }

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} onRetry={refresh} />;
  if (!timesheet) return <ErrorMessage message="Timesheet not found" />;

  const isEditable = timesheet.status === 'open';
  const employeeAge = calculateAge(employee!.dateOfBirth, timesheet.weekStartDate);
  const birthdayInfo = checkBirthdayInWeek(employee!.dateOfBirth, timesheet.weekStartDate);

  return (
    <div className="timesheet-page">
      <header className="timesheet-header">
        <h1>My Timesheet</h1>
        <WeekSelector
          selectedWeek={timesheet.weekStartDate}
          onWeekChange={(week) => navigate(`/timesheet/${week}`)}
        />
        {saving && <span className="saving-indicator">Saving...</span>}
      </header>

      {birthdayInfo?.hasBirthday && (
        <Alert type="info">
          Your birthday falls during this week! Different rules may apply
          before and after {birthdayInfo.birthdayDate}.
        </Alert>
      )}

      {!isEditable && (
        <Alert type="warning">
          This timesheet has been {timesheet.status}. It cannot be edited.
          {timesheet.supervisorNotes && (
            <p>Supervisor notes: {timesheet.supervisorNotes}</p>
          )}
        </Alert>
      )}

      <TimesheetGrid
        timesheet={timesheet}
        totals={totals!}
        employeeAge={employeeAge}
        onAddEntry={(date) => setSelectedDate(date)}
        onEditEntry={(id) => setEditingEntry(id)}
        onDeleteEntry={deleteEntry}
        onSchoolDayToggle={handleSchoolDayToggle}
        disabled={!isEditable}
      />

      <TimesheetTotalsSummary
        totals={totals!}
        ageBand={getAgeBand(employeeAge)}
      />

      {selectedDate && (
        <EntryFormModal
          isOpen={true}
          onClose={() => setSelectedDate(null)}
          onSubmit={(entry) => addEntry(entry as CreateEntryRequest)}
          date={selectedDate}
          employeeId={employee!.id}
          employeeAge={calculateAge(employee!.dateOfBirth, selectedDate)}
          isSchoolDay={isDefaultSchoolDay(selectedDate)}
        />
      )}

      {editingEntry && (
        <EntryFormModal
          isOpen={true}
          onClose={() => setEditingEntry(null)}
          onSubmit={(updates) => updateEntry(editingEntry, updates)}
          entry={timesheet.entries.find(e => e.id === editingEntry)!}
          date={timesheet.entries.find(e => e.id === editingEntry)!.workDate}
          employeeId={employee!.id}
          employeeAge={calculateAge(
            employee!.dateOfBirth,
            timesheet.entries.find(e => e.id === editingEntry)!.workDate
          )}
          isSchoolDay={timesheet.entries.find(e => e.id === editingEntry)!.isSchoolDay}
        />
      )}
    </div>
  );
}
```

---

### Task 6.13: Hour Limits Display Component

**Goal**: Create component showing hour limits and warnings.

**Files to Create:**
- `packages/frontend/src/components/HourLimitsDisplay.tsx`

**Features:**
- Show daily and weekly limits based on age band
- Visual progress bars
- Warning colors when approaching limits (80%)
- Error colors when at/over limits
- Different limits for school days vs non-school days (ages 14-15)

**Hour Limits Reference:**

| Age Band | Daily Limit | Weekly Limit | Notes |
|----------|-------------|--------------|-------|
| 12-13 | 4 hrs | 24 hrs | |
| 14-15 | 3 hrs (school day) | 18 hrs (school week) | 8 hrs non-school day |
| 16-17 | 9 hrs | 48 hrs | Max 6 days/week |
| 18+ | None | None | |

---

### Task 6.14: School Day Override Modal

**Goal**: Create modal for overriding school day status.

**Files to Create:**
- `packages/frontend/src/components/SchoolDayOverrideModal.tsx`

**Features:**
- Explain why override is being requested
- Require minimum 10-character note (per REQ-005)
- Clear warning about compliance implications
- Confirm/Cancel buttons

---

### Task 6.15: Navigation Updates

**Goal**: Add timesheet link to main navigation.

**Files to Modify:**
- `packages/frontend/src/components/Navigation.tsx` (or similar)
- `packages/frontend/src/App.tsx` (ensure route protection)

**Changes:**
- Add "My Timesheet" link for all authenticated employees
- Show current week's status indicator in nav
- Quick access to pending items

---

### Task 6.16: Component Tests

**Goal**: Write tests for new React components.

**Test Files to Create:**
- `packages/frontend/src/components/__tests__/WeekSelector.test.tsx`
- `packages/frontend/src/components/__tests__/TimesheetGrid.test.tsx`
- `packages/frontend/src/components/__tests__/DayCell.test.tsx`
- `packages/frontend/src/components/__tests__/EntryFormModal.test.tsx`
- `packages/frontend/src/pages/__tests__/Timesheet.test.tsx`

**Test Cases:**

**WeekSelector:**
- Renders current week by default
- Navigation to previous week works
- Cannot navigate to future weeks
- Shows lock icon for locked weeks

**TimesheetGrid:**
- Renders all 7 days
- Shows entries in correct day cells
- Calculates daily totals correctly
- Shows weekly total
- Disabled state prevents interactions

**DayCell:**
- Shows date correctly
- Lists entries
- Shows daily total
- Warning state when approaching limit
- Add entry button works
- School day toggle works

**EntryFormModal:**
- Shows task code dropdown
- Validates required fields
- Shows supervisor field when needed
- Shows meal break when hours > 6
- Calculates hours in real-time
- Submit calls onSubmit with correct data

**Timesheet Page:**
- Redirects if documentation incomplete
- Shows week selector
- Shows timesheet grid
- Shows totals summary
- Read-only when submitted

---

### Task 6.17: Integration Tests

**Goal**: Write integration tests for timesheet API.

**Test Files to Create/Modify:**
- `packages/backend/src/__tests__/routes/timesheets.test.ts`

**Test Cases:**

- GET /timesheets returns employee's timesheets only
- GET /timesheets/current creates new if none exists
- GET /timesheets/current returns existing if already created
- POST entries creates entry with calculated hours
- POST entries rejects if timesheet not editable
- POST entries rejects if task code age-inappropriate
- PATCH entries updates entry
- DELETE entries removes entry
- Totals endpoint returns correct calculations

---

### Task 6.18: E2E Tests

**Goal**: Write end-to-end tests for timesheet entry flow.

**Test Files to Create:**
- `packages/frontend/e2e/timesheet-entry.spec.ts`

**Test Scenarios:**

1. **Basic Entry Flow**
   - Log in as employee
   - Navigate to timesheet
   - Add entry for today
   - Verify entry appears in grid
   - Verify totals update

2. **Edit Entry**
   - Create entry
   - Edit entry to change times
   - Verify hours recalculate

3. **Delete Entry**
   - Create entry
   - Delete entry
   - Verify removed from grid

4. **School Day Override**
   - Navigate to school day
   - Toggle school day status
   - Enter required note
   - Verify override saved

5. **Supervisor Attestation**
   - Select supervisor-required task
   - Verify supervisor name field appears
   - Enter supervisor name
   - Verify saved

6. **Meal Break Confirmation**
   - Enter > 6 hours
   - Verify meal break prompt appears
   - Confirm meal break
   - Verify saved

7. **Week Navigation**
   - Start on current week
   - Navigate to previous week
   - Verify different timesheet loads
   - Cannot navigate to future

---

## File Summary

### Files to Create (18 files)

**Backend:**
1. `packages/backend/src/services/timesheet.service.ts`
2. `packages/backend/src/services/timesheet-entry.service.ts`
3. `packages/backend/src/validation/timesheet.schema.ts`
4. `packages/backend/src/routes/timesheets.ts`
5. `packages/backend/src/__tests__/services/timesheet.service.test.ts`
6. `packages/backend/src/__tests__/services/timesheet-entry.service.test.ts`
7. `packages/backend/src/__tests__/validation/timesheet.schema.test.ts`
8. `packages/backend/src/__tests__/routes/timesheets.test.ts`

**Frontend:**
9. `packages/frontend/src/hooks/useTimesheet.ts`
10. `packages/frontend/src/components/WeekSelector.tsx`
11. `packages/frontend/src/components/TimesheetGrid.tsx`
12. `packages/frontend/src/components/DayCell.tsx`
13. `packages/frontend/src/components/EntryFormModal.tsx`
14. `packages/frontend/src/components/HourLimitsDisplay.tsx`
15. `packages/frontend/src/components/SchoolDayOverrideModal.tsx`
16. `packages/frontend/src/pages/Timesheet.tsx`
17. `packages/frontend/src/components/__tests__/TimesheetGrid.test.tsx`
18. `packages/frontend/e2e/timesheet-entry.spec.ts`

### Files to Modify (5 files)

1. `packages/backend/src/services/index.ts` - Export new services
2. `packages/backend/src/routes/index.ts` - Register timesheet routes
3. `shared/types/src/api.ts` - Add timesheet API types
4. `packages/frontend/src/api/client.ts` - Add timesheet methods
5. `packages/frontend/src/App.tsx` - Add timesheet routes

---

## Acceptance Criteria Checklist

### REQ-004: Task Code Time Entry
- [ ] System requires valid task code for every entry
- [ ] Task codes filtered by employee age
- [ ] Task shows name, description, hourly rate
- [ ] Multiple entries per day supported
- [ ] Captures start time, end time, task code
- [ ] Hours calculated automatically

### REQ-005: School Day Tracking
- [ ] School day status displayed for employees under 18
- [ ] Monday-Friday Aug 28 - Jun 20 default as school days
- [ ] Other days default as non-school days
- [ ] Override capability with required note (min 10 chars)
- [ ] School day designations read-only after submission

### REQ-010: Supervisor Attestation
- [ ] Prompt for supervisor name when task flagged "Supervisor Required"
- [ ] Required entry before save allowed
- [ ] Attestation stored with entry

### REQ-013: Meal Break Verification
- [ ] Prompt when daily hours > 6 for employees under 18
- [ ] Explicit attestation required
- [ ] Block until confirmed or hours adjusted

### REQ-019: Weekly Timesheet Selection
- [ ] Work week defined as Sunday-Saturday
- [ ] Default to current week
- [ ] Historical weeks viewable (read-only)
- [ ] Past weeks locked by default
- [ ] Supervisor can unlock (Phase 8)

### REQ-020: Birthday Mid-Period Rule Switching
- [ ] Age calculated per date of work
- [ ] Rules applied based on age on that specific date
- [ ] Birthday transition notification shown

---

## Dependencies on Other Phases

### Required from Phase 7 (Compliance Engine)
- Phase 6 displays warnings but does NOT block submission
- Phase 7 will add the actual compliance checks that block
- Hour limits shown are informational in Phase 6
- Submit button will be wired in Phase 8

### Hooks for Phase 8 (Submission Workflow)
- Timesheet status field ready ('open' | 'submitted' | 'approved' | 'rejected')
- Read-only mode when status != 'open'
- Supervisor notes display when rejected

---

## Estimated Task Order

1. Task 6.1 + 6.2: Services (backend foundation)
2. Task 6.3: Validation schemas
3. Task 6.4 + 6.5: API routes and types
4. Task 6.6: Frontend API client
5. Task 6.7: useTimesheet hook
6. Task 6.8 + 6.9 + 6.10: Grid components
7. Task 6.11: Entry form modal
8. Task 6.12: Timesheet page
9. Task 6.13 + 6.14: Supporting components
10. Task 6.15: Navigation updates
11. Task 6.16 + 6.17 + 6.18: Tests

---

## Notes

### UX Considerations for Youth Users
- Keep interface simple and clear
- Use large touch targets for mobile field use
- Show hours in simple decimal (4.5 hrs) not minutes
- Warning messages should be friendly, not alarming
- Error messages written for 12-year-old comprehension level

### Performance Considerations
- Eager load entries when fetching timesheet
- Calculate totals server-side to ensure accuracy
- Debounce save operations when editing
- Cache task codes (they change infrequently)

### Accessibility
- All form fields properly labeled
- Color-coded warnings also have text
- Keyboard navigation for grid
- Screen reader support for totals
