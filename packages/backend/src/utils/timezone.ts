/**
 * Timezone utilities for America/New_York (REQ-029).
 * All times in the application are Eastern Time.
 */

export const TIMEZONE = 'America/New_York';

/**
 * Get current date in Eastern Time as YYYY-MM-DD string.
 */
export function getTodayET(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE });
}

/**
 * Get the Sunday (week start) for a given date.
 */
export function getWeekStartDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d.toISOString().split('T')[0]!;
}

/**
 * Parse time string (HH:MM) to minutes since midnight.
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

/**
 * Check if a time falls within school hours (7 AM - 3 PM).
 */
export function isWithinSchoolHours(time: string): boolean {
  const minutes = timeToMinutes(time);
  const schoolStart = 7 * 60; // 7:00 AM
  const schoolEnd = 15 * 60; // 3:00 PM
  return minutes >= schoolStart && minutes < schoolEnd;
}

/**
 * Check if a date falls within the default school year (Aug 28 - Jun 20).
 */
export function isDefaultSchoolYear(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
  const month = d.getMonth(); // 0-indexed
  const day = d.getDate();

  // Aug 28 (month 7) to Dec 31
  if (month > 7 || (month === 7 && day >= 28)) {
    return true;
  }
  // Jan 1 to Jun 20 (month 5)
  if (month < 5 || (month === 5 && day <= 20)) {
    return true;
  }
  return false;
}

/**
 * Check if a date is a default school day (Mon-Fri during school year).
 */
export function isDefaultSchoolDay(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
  const dayOfWeek = d.getDay();

  // Weekend = not a school day
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }

  // Check if within school year
  return isDefaultSchoolYear(d);
}
