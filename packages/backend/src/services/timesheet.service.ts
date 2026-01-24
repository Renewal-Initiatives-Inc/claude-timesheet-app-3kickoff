import { eq, and, desc, asc, inArray, gte, lte } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import type { Timesheet, TimesheetStatus } from '@renewal/types';
import { getTodayET, getWeekStartDate } from '../utils/timezone.js';

const { timesheets, timesheetEntries, employees, taskCodes, taskCodeRates } = schema;

type TimesheetRow = typeof timesheets.$inferSelect;
type TimesheetEntryRow = typeof timesheetEntries.$inferSelect;

/**
 * Error codes for timesheet operations.
 */
export type TimesheetErrorCode =
  | 'TIMESHEET_NOT_FOUND'
  | 'TIMESHEET_NOT_EDITABLE'
  | 'TIMESHEET_ACCESS_DENIED'
  | 'EMPLOYEE_NOT_FOUND'
  | 'INVALID_WEEK_START_DATE';

/**
 * Error thrown for timesheet-related business logic errors.
 */
export class TimesheetError extends Error {
  constructor(
    message: string,
    public code: TimesheetErrorCode
  ) {
    super(message);
    this.name = 'TimesheetError';
  }
}

/**
 * Convert database row to public Timesheet.
 */
function toPublicTimesheet(row: TimesheetRow): Timesheet {
  return {
    id: row.id,
    employeeId: row.employeeId,
    weekStartDate: row.weekStartDate,
    status: row.status as TimesheetStatus,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    reviewedBy: row.reviewedBy,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    supervisorNotes: row.supervisorNotes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Validate that a date is a Sunday (week start).
 */
function isValidSunday(dateStr: string): boolean {
  const date = new Date(dateStr + 'T00:00:00');
  return date.getDay() === 0;
}

/**
 * Get dates for all days in a week starting from Sunday.
 */
export function getWeekDates(weekStartDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(weekStartDate + 'T00:00:00');
  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    dates.push(date.toISOString().split('T')[0]!);
  }
  return dates;
}

/**
 * Get or create a timesheet for an employee and week.
 * If a timesheet already exists for the employee and week, return it.
 * Otherwise, create a new timesheet.
 */
export async function getOrCreateTimesheet(
  employeeId: string,
  weekStartDate: string
): Promise<Timesheet> {
  // Validate week start date is a Sunday
  if (!isValidSunday(weekStartDate)) {
    throw new TimesheetError(
      'Week start date must be a Sunday',
      'INVALID_WEEK_START_DATE'
    );
  }

  // Verify employee exists
  const employee = await db.query.employees.findFirst({
    where: eq(employees.id, employeeId),
  });

  if (!employee) {
    throw new TimesheetError('Employee not found', 'EMPLOYEE_NOT_FOUND');
  }

  // Check for existing timesheet
  const existing = await db.query.timesheets.findFirst({
    where: and(
      eq(timesheets.employeeId, employeeId),
      eq(timesheets.weekStartDate, weekStartDate)
    ),
  });

  if (existing) {
    return toPublicTimesheet(existing);
  }

  // Create new timesheet
  const [newTimesheet] = await db
    .insert(timesheets)
    .values({
      employeeId,
      weekStartDate,
      status: 'open',
    })
    .returning();

  return toPublicTimesheet(newTimesheet!);
}

/**
 * Get a timesheet by ID.
 */
export async function getTimesheetById(id: string): Promise<Timesheet | null> {
  const timesheet = await db.query.timesheets.findFirst({
    where: eq(timesheets.id, id),
  });

  if (!timesheet) {
    return null;
  }

  return toPublicTimesheet(timesheet);
}

/**
 * Get a timesheet with all its entries.
 */
export async function getTimesheetWithEntries(
  timesheetId: string
): Promise<TimesheetWithEntries | null> {
  const timesheet = await db.query.timesheets.findFirst({
    where: eq(timesheets.id, timesheetId),
    with: {
      entries: {
        with: {
          taskCode: true,
        },
        orderBy: [asc(timesheetEntries.workDate), asc(timesheetEntries.startTime)],
      },
    },
  });

  if (!timesheet) {
    return null;
  }

  // Batch fetch all rates for task codes in this timesheet (optimized from N+1 to single query)
  const uniqueTaskCodeIds = [...new Set(timesheet.entries.map((e) => e.taskCodeId))];

  // Fetch all rates for these task codes
  const allRates = uniqueTaskCodeIds.length > 0
    ? await db.query.taskCodeRates.findMany({
        where: inArray(taskCodeRates.taskCodeId, uniqueTaskCodeIds),
        orderBy: [desc(taskCodeRates.effectiveDate)],
      })
    : [];

  // Build lookup: taskCodeId -> array of rates (sorted by effectiveDate desc)
  const ratesByTaskCode = new Map<string, typeof allRates>();
  for (const rate of allRates) {
    const existing = ratesByTaskCode.get(rate.taskCodeId) ?? [];
    existing.push(rate);
    ratesByTaskCode.set(rate.taskCodeId, existing);
  }

  // Helper to find the effective rate for a task code on a given date
  function findEffectiveRate(taskCodeId: string, workDate: string): number {
    const rates = ratesByTaskCode.get(taskCodeId) ?? [];
    for (const rate of rates) {
      if (rate.effectiveDate <= workDate) {
        return parseFloat(rate.hourlyRate);
      }
    }
    return 0;
  }

  const entriesWithRates = timesheet.entries.map((entry) => ({
    id: entry.id,
    timesheetId: entry.timesheetId,
    workDate: entry.workDate,
    taskCodeId: entry.taskCodeId,
    startTime: entry.startTime,
    endTime: entry.endTime,
    hours: entry.hours,
    isSchoolDay: entry.isSchoolDay,
    schoolDayOverrideNote: entry.schoolDayOverrideNote,
    supervisorPresentName: entry.supervisorPresentName,
    mealBreakConfirmed: entry.mealBreakConfirmed,
    createdAt: entry.createdAt.toISOString(),
    taskCode: {
      id: entry.taskCode.id,
      code: entry.taskCode.code,
      name: entry.taskCode.name,
      description: entry.taskCode.description,
      isAgricultural: entry.taskCode.isAgricultural,
      isHazardous: entry.taskCode.isHazardous,
      supervisorRequired: entry.taskCode.supervisorRequired,
      soloCashHandling: entry.taskCode.soloCashHandling,
      drivingRequired: entry.taskCode.drivingRequired,
      powerMachinery: entry.taskCode.powerMachinery,
      minAgeAllowed: entry.taskCode.minAgeAllowed,
      isActive: entry.taskCode.isActive,
      createdAt: entry.taskCode.createdAt.toISOString(),
      updatedAt: entry.taskCode.updatedAt.toISOString(),
      currentRate: findEffectiveRate(entry.taskCodeId, entry.workDate),
    },
  }));

  // Calculate daily and weekly totals
  const dailyTotals: Record<string, number> = {};
  let weeklyTotal = 0;

  for (const entry of entriesWithRates) {
    const hours = parseFloat(entry.hours);
    dailyTotals[entry.workDate] = (dailyTotals[entry.workDate] || 0) + hours;
    weeklyTotal += hours;
  }

  return {
    ...toPublicTimesheet(timesheet),
    entries: entriesWithRates,
    totals: {
      daily: dailyTotals,
      weekly: weeklyTotal,
    },
  };
}

/**
 * Options for listing timesheets.
 */
export interface ListTimesheetsOptions {
  status?: TimesheetStatus[];
  limit?: number;
  offset?: number;
}

/**
 * Get timesheets for an employee.
 */
export async function getEmployeeTimesheets(
  employeeId: string,
  options: ListTimesheetsOptions = {}
): Promise<{ timesheets: Timesheet[]; total: number }> {
  const { status, limit = 10, offset = 0 } = options;

  // Build where conditions
  const conditions = [eq(timesheets.employeeId, employeeId)];

  if (status && status.length > 0) {
    conditions.push(inArray(timesheets.status, status));
  }

  const timesheetList = await db.query.timesheets.findMany({
    where: and(...conditions),
    orderBy: [desc(timesheets.weekStartDate)],
    limit,
    offset,
  });

  // Get total count
  const allTimesheets = await db.query.timesheets.findMany({
    where: and(...conditions),
  });

  return {
    timesheets: timesheetList.map(toPublicTimesheet),
    total: allTimesheets.length,
  };
}

/**
 * Validate that an employee owns a timesheet.
 */
export async function validateTimesheetAccess(
  timesheetId: string,
  employeeId: string
): Promise<boolean> {
  const timesheet = await db.query.timesheets.findFirst({
    where: eq(timesheets.id, timesheetId),
  });

  if (!timesheet) {
    throw new TimesheetError('Timesheet not found', 'TIMESHEET_NOT_FOUND');
  }

  return timesheet.employeeId === employeeId;
}

/**
 * Check if a timesheet is editable (status === 'open').
 */
export function isTimesheetEditable(timesheet: Timesheet): boolean {
  return timesheet.status === 'open';
}

/**
 * Timesheet with entries and totals.
 */
export interface TimesheetWithEntries extends Timesheet {
  entries: TimesheetEntryWithTaskCode[];
  totals: {
    daily: Record<string, number>;
    weekly: number;
  };
}

/**
 * Timesheet entry with associated task code.
 */
export interface TimesheetEntryWithTaskCode {
  id: string;
  timesheetId: string;
  workDate: string;
  taskCodeId: string;
  startTime: string;
  endTime: string;
  hours: string;
  isSchoolDay: boolean;
  schoolDayOverrideNote: string | null;
  supervisorPresentName: string | null;
  mealBreakConfirmed: boolean | null;
  createdAt: string;
  taskCode: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    isAgricultural: boolean;
    isHazardous: boolean;
    supervisorRequired: string;
    soloCashHandling: boolean;
    drivingRequired: boolean;
    powerMachinery: boolean;
    minAgeAllowed: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    currentRate: number;
  };
}
