import type { TimesheetWithEntries, TimesheetTotals, TimesheetEntryWithTaskCode, HourLimits } from '@renewal/types';
import { DayCell } from './DayCell.js';
import './TimesheetGrid.css';

interface TimesheetGridProps {
  timesheet: TimesheetWithEntries;
  totals: TimesheetTotals;
  employeeAge: number;
  onAddEntry: (date: string) => void;
  onEditEntry: (entryId: string) => void;
  onDeleteEntry: (entryId: string) => void;
  disabled?: boolean;
}

/**
 * Get week dates for a timesheet (Sun-Sat)
 */
function getWeekDates(weekStartDate: string): string[] {
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
 * Get day of week name
 */
function getDayOfWeek(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()]!;
}

/**
 * Check if a date is a default school day (Mon-Fri during Aug 28 - Jun 20)
 */
function isDefaultSchoolDay(dateStr: string): boolean {
  const date = new Date(dateStr + 'T00:00:00');
  const dayOfWeek = date.getDay();

  // Weekend = not a school day
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }

  // Check if within school year (Aug 28 - Jun 20)
  const month = date.getMonth();
  const day = date.getDate();

  // Aug 28 to Dec 31
  if (month > 7 || (month === 7 && day >= 28)) {
    return true;
  }
  // Jan 1 to Jun 20
  if (month < 5 || (month === 5 && day <= 20)) {
    return true;
  }

  return false;
}

/**
 * Group entries by date
 */
function groupEntriesByDate(entries: TimesheetEntryWithTaskCode[]): Map<string, TimesheetEntryWithTaskCode[]> {
  const grouped = new Map<string, TimesheetEntryWithTaskCode[]>();
  for (const entry of entries) {
    const existing = grouped.get(entry.workDate) || [];
    existing.push(entry);
    grouped.set(entry.workDate, existing);
  }
  return grouped;
}

/**
 * Get daily limit for a date based on age and school day status
 */
function getDailyLimit(age: number, isSchoolDay: boolean, limits: HourLimits): number {
  if (limits.dailyLimitSchoolDay !== undefined && isSchoolDay) {
    return limits.dailyLimitSchoolDay;
  }
  return limits.dailyLimit;
}

export function TimesheetGrid({
  timesheet,
  totals,
  employeeAge,
  onAddEntry,
  onEditEntry,
  onDeleteEntry,
  disabled,
}: TimesheetGridProps) {
  const weekDates = getWeekDates(timesheet.weekStartDate);
  const entriesByDate = groupEntriesByDate(timesheet.entries);

  return (
    <div className="timesheet-grid">
      <div className="grid-body">
        {weekDates.map((date) => {
          const entries = entriesByDate.get(date) || [];
          const isSchoolDay = entries.length > 0
            ? entries[0]!.isSchoolDay
            : isDefaultSchoolDay(date);
          const dailyLimit = getDailyLimit(employeeAge, isSchoolDay, totals.limits);

          return (
            <DayCell
              key={date}
              date={date}
              dayOfWeek={getDayOfWeek(date)}
              entries={entries}
              dailyTotal={totals.daily[date] || 0}
              dailyLimit={dailyLimit}
              employeeAge={employeeAge}
              isSchoolDay={isSchoolDay}
              onAddEntry={() => onAddEntry(date)}
              onEditEntry={onEditEntry}
              onDeleteEntry={onDeleteEntry}
              disabled={disabled}
            />
          );
        })}
      </div>

      <div className="grid-footer">
        <div className="weekly-total">
          <span className="weekly-total-label">Weekly Total:</span>
          <span
            className={`weekly-total-hours ${
              totals.weekly >= totals.limits.weeklyLimit * 0.8
                ? totals.weekly >= totals.limits.weeklyLimit
                  ? 'at-limit'
                  : 'approaching-limit'
                : ''
            }`}
          >
            {totals.weekly.toFixed(1)}
          </span>
          <span className="weekly-total-separator">/</span>
          <span className="weekly-total-limit">{totals.limits.weeklyLimit}</span>
          <span className="weekly-total-unit">hours</span>
        </div>

        {totals.warnings.length > 0 && (
          <div className="warnings-list">
            {totals.warnings.map((warning: string, idx: number) => (
              <div key={idx} className="warning-item">
                &#9888; {warning}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
