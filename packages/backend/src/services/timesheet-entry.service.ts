import { eq } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import type { TimesheetEntry } from '@renewal/types';
import { isDefaultSchoolDay, timeToMinutes } from '../utils/timezone.js';
import { getWeekDates } from './timesheet.service.js';

const { timesheetEntries, timesheets, taskCodes } = schema;

type TimesheetEntryRow = typeof timesheetEntries.$inferSelect;

/**
 * Error codes for timesheet entry operations.
 */
export type TimesheetEntryErrorCode =
  | 'ENTRY_NOT_FOUND'
  | 'INVALID_TIME_RANGE'
  | 'DATE_OUTSIDE_WEEK'
  | 'TIMESHEET_NOT_EDITABLE'
  | 'TIMESHEET_NOT_FOUND'
  | 'TASK_CODE_NOT_FOUND'
  | 'TASK_CODE_AGE_RESTRICTED';

/**
 * Error thrown for timesheet entry-related business logic errors.
 */
export class TimesheetEntryError extends Error {
  constructor(
    message: string,
    public code: TimesheetEntryErrorCode
  ) {
    super(message);
    this.name = 'TimesheetEntryError';
  }
}

/**
 * Convert database row to public TimesheetEntry.
 */
function toPublicEntry(row: TimesheetEntryRow): TimesheetEntry {
  return {
    id: row.id,
    timesheetId: row.timesheetId,
    workDate: row.workDate,
    taskCodeId: row.taskCodeId,
    startTime: row.startTime,
    endTime: row.endTime,
    hours: row.hours,
    isSchoolDay: row.isSchoolDay,
    schoolDayOverrideNote: row.schoolDayOverrideNote,
    supervisorPresentName: row.supervisorPresentName,
    mealBreakConfirmed: row.mealBreakConfirmed,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Calculate hours from start and end time strings (HH:MM).
 * Returns decimal hours rounded to 2 places.
 */
export function calculateHours(startTime: string, endTime: string): number {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  if (endMinutes <= startMinutes) {
    throw new TimesheetEntryError('End time must be after start time', 'INVALID_TIME_RANGE');
  }

  const totalMinutes = endMinutes - startMinutes;
  return Math.round((totalMinutes / 60) * 100) / 100;
}

/**
 * Check if a date is valid for a timesheet week.
 */
export function validateEntryDate(weekStartDate: string, workDate: string): boolean {
  const weekDates = getWeekDates(weekStartDate);
  return weekDates.includes(workDate);
}

/**
 * Get default school day status for a date.
 */
export function getDefaultSchoolDayStatus(workDate: string): boolean {
  return isDefaultSchoolDay(workDate);
}

/**
 * Input for creating a timesheet entry.
 */
export interface CreateEntryInput {
  workDate: string;
  taskCodeId: string;
  startTime: string;
  endTime: string;
  isSchoolDay: boolean;
  schoolDayOverrideNote?: string | null;
  supervisorPresentName?: string | null;
  mealBreakConfirmed?: boolean | null;
}

/**
 * Create a new timesheet entry.
 */
export async function createEntry(
  timesheetId: string,
  input: CreateEntryInput
): Promise<TimesheetEntry> {
  // Get and validate timesheet
  const timesheet = await db.query.timesheets.findFirst({
    where: eq(timesheets.id, timesheetId),
  });

  if (!timesheet) {
    throw new TimesheetEntryError('Timesheet not found', 'TIMESHEET_NOT_FOUND');
  }

  if (timesheet.status !== 'open') {
    throw new TimesheetEntryError(
      `Cannot add entries to timesheet with status: ${timesheet.status}`,
      'TIMESHEET_NOT_EDITABLE'
    );
  }

  // Validate work date is within the timesheet week
  if (!validateEntryDate(timesheet.weekStartDate, input.workDate)) {
    throw new TimesheetEntryError(
      'Work date must be within the timesheet week',
      'DATE_OUTSIDE_WEEK'
    );
  }

  // Validate task code exists
  const taskCode = await db.query.taskCodes.findFirst({
    where: eq(taskCodes.id, input.taskCodeId),
  });

  if (!taskCode) {
    throw new TimesheetEntryError('Task code not found', 'TASK_CODE_NOT_FOUND');
  }

  // Calculate hours
  const hours = calculateHours(input.startTime, input.endTime);

  // Create entry
  const [newEntry] = await db
    .insert(timesheetEntries)
    .values({
      timesheetId,
      workDate: input.workDate,
      taskCodeId: input.taskCodeId,
      startTime: input.startTime,
      endTime: input.endTime,
      hours: hours.toFixed(2),
      isSchoolDay: input.isSchoolDay,
      schoolDayOverrideNote: input.schoolDayOverrideNote ?? null,
      supervisorPresentName: input.supervisorPresentName ?? null,
      mealBreakConfirmed: input.mealBreakConfirmed ?? null,
    })
    .returning();

  return toPublicEntry(newEntry!);
}

/**
 * Input for updating a timesheet entry.
 */
export interface UpdateEntryInput {
  startTime?: string;
  endTime?: string;
  taskCodeId?: string;
  isSchoolDay?: boolean;
  schoolDayOverrideNote?: string | null;
  supervisorPresentName?: string | null;
  mealBreakConfirmed?: boolean | null;
}

/**
 * Update an existing timesheet entry.
 */
export async function updateEntry(
  entryId: string,
  input: UpdateEntryInput
): Promise<TimesheetEntry> {
  // Get entry with timesheet
  const entry = await db.query.timesheetEntries.findFirst({
    where: eq(timesheetEntries.id, entryId),
    with: {
      timesheet: true,
    },
  });

  if (!entry) {
    throw new TimesheetEntryError('Entry not found', 'ENTRY_NOT_FOUND');
  }

  if (entry.timesheet.status !== 'open') {
    throw new TimesheetEntryError(
      `Cannot update entries on timesheet with status: ${entry.timesheet.status}`,
      'TIMESHEET_NOT_EDITABLE'
    );
  }

  // Validate task code if being changed
  if (input.taskCodeId) {
    const taskCode = await db.query.taskCodes.findFirst({
      where: eq(taskCodes.id, input.taskCodeId),
    });

    if (!taskCode) {
      throw new TimesheetEntryError('Task code not found', 'TASK_CODE_NOT_FOUND');
    }
  }

  // Build update object
  const updates: Partial<typeof timesheetEntries.$inferInsert> = {};

  // Handle time changes
  const newStartTime = input.startTime ?? entry.startTime;
  const newEndTime = input.endTime ?? entry.endTime;

  if (input.startTime || input.endTime) {
    const hours = calculateHours(newStartTime, newEndTime);
    updates.startTime = newStartTime;
    updates.endTime = newEndTime;
    updates.hours = hours.toFixed(2);
  }

  if (input.taskCodeId !== undefined) updates.taskCodeId = input.taskCodeId;
  if (input.isSchoolDay !== undefined) updates.isSchoolDay = input.isSchoolDay;
  if (input.schoolDayOverrideNote !== undefined)
    updates.schoolDayOverrideNote = input.schoolDayOverrideNote;
  if (input.supervisorPresentName !== undefined)
    updates.supervisorPresentName = input.supervisorPresentName;
  if (input.mealBreakConfirmed !== undefined) updates.mealBreakConfirmed = input.mealBreakConfirmed;

  const [updated] = await db
    .update(timesheetEntries)
    .set(updates)
    .where(eq(timesheetEntries.id, entryId))
    .returning();

  return toPublicEntry(updated!);
}

/**
 * Delete a timesheet entry.
 */
export async function deleteEntry(entryId: string): Promise<void> {
  // Get entry with timesheet
  const entry = await db.query.timesheetEntries.findFirst({
    where: eq(timesheetEntries.id, entryId),
    with: {
      timesheet: true,
    },
  });

  if (!entry) {
    throw new TimesheetEntryError('Entry not found', 'ENTRY_NOT_FOUND');
  }

  if (entry.timesheet.status !== 'open') {
    throw new TimesheetEntryError(
      `Cannot delete entries from timesheet with status: ${entry.timesheet.status}`,
      'TIMESHEET_NOT_EDITABLE'
    );
  }

  await db.delete(timesheetEntries).where(eq(timesheetEntries.id, entryId));
}

/**
 * Get an entry by ID.
 */
export async function getEntryById(entryId: string): Promise<TimesheetEntry | null> {
  const entry = await db.query.timesheetEntries.findFirst({
    where: eq(timesheetEntries.id, entryId),
  });

  if (!entry) {
    return null;
  }

  return toPublicEntry(entry);
}

/**
 * Get daily totals for a timesheet.
 */
export async function getDailyTotals(timesheetId: string): Promise<Record<string, number>> {
  const entries = await db.query.timesheetEntries.findMany({
    where: eq(timesheetEntries.timesheetId, timesheetId),
  });

  const totals: Record<string, number> = {};
  for (const entry of entries) {
    const hours = parseFloat(entry.hours);
    totals[entry.workDate] = (totals[entry.workDate] || 0) + hours;
  }

  return totals;
}

/**
 * Get weekly total for a timesheet.
 */
export async function getWeeklyTotal(timesheetId: string): Promise<number> {
  const entries = await db.query.timesheetEntries.findMany({
    where: eq(timesheetEntries.timesheetId, timesheetId),
  });

  let total = 0;
  for (const entry of entries) {
    total += parseFloat(entry.hours);
  }

  return Math.round(total * 100) / 100;
}

/**
 * Get all entries for a timesheet grouped by date.
 */
export async function getEntriesGroupedByDate(
  timesheetId: string
): Promise<Map<string, TimesheetEntry[]>> {
  const entries = await db.query.timesheetEntries.findMany({
    where: eq(timesheetEntries.timesheetId, timesheetId),
    orderBy: [timesheetEntries.startTime],
  });

  const grouped = new Map<string, TimesheetEntry[]>();
  for (const entry of entries) {
    const publicEntry = toPublicEntry(entry);
    const existing = grouped.get(entry.workDate) || [];
    existing.push(publicEntry);
    grouped.set(entry.workDate, existing);
  }

  return grouped;
}

/**
 * Hour limits by age band.
 */
export interface HourLimits {
  dailyLimit: number;
  dailyLimitSchoolDay?: number; // Different limit for school days (14-15)
  weeklyLimit: number;
  weeklyLimitSchoolWeek?: number; // Different limit for school weeks (14-15)
  daysWorkedLimit?: number; // Max days per week (16-17)
}

/**
 * Get hour limits based on age.
 */
export function getHourLimitsForAge(age: number): HourLimits {
  if (age >= 18) {
    return {
      dailyLimit: 24, // No limit
      weeklyLimit: 168, // No limit
    };
  }

  if (age >= 16) {
    return {
      dailyLimit: 9,
      weeklyLimit: 48,
      daysWorkedLimit: 6,
    };
  }

  if (age >= 14) {
    return {
      dailyLimit: 8, // Non-school day
      dailyLimitSchoolDay: 3,
      weeklyLimit: 40, // Non-school week
      weeklyLimitSchoolWeek: 18,
    };
  }

  // Ages 12-13
  return {
    dailyLimit: 4,
    weeklyLimit: 24,
  };
}

/**
 * Get age band string.
 */
export function getAgeBand(age: number): '12-13' | '14-15' | '16-17' | '18+' {
  if (age >= 18) return '18+';
  if (age >= 16) return '16-17';
  if (age >= 14) return '14-15';
  return '12-13';
}
