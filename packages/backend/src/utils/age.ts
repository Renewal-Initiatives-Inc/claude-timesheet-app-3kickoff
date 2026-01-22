/**
 * Age calculation utilities for compliance rule evaluation.
 *
 * CRITICAL: Age must be calculated as of the specific work date, not current date.
 * This handles birthday mid-period scenarios correctly (REQ-020, RULE-031).
 */

/**
 * Calculate age in whole years as of a specific date.
 *
 * @param dateOfBirth - Employee's date of birth (YYYY-MM-DD string or Date)
 * @param asOfDate - The date to calculate age as of (YYYY-MM-DD string or Date)
 * @returns Age in whole years (always rounds down)
 *
 * @example
 * // Employee born 2010-06-15
 * calculateAge('2010-06-15', '2024-06-14') // Returns 13
 * calculateAge('2010-06-15', '2024-06-15') // Returns 14 (birthday!)
 * calculateAge('2010-06-15', '2024-06-16') // Returns 14
 */
export function calculateAge(dateOfBirth: string | Date, asOfDate: string | Date): number {
  const dob = typeof dateOfBirth === 'string' ? new Date(dateOfBirth + 'T00:00:00') : dateOfBirth;
  const asOf = typeof asOfDate === 'string' ? new Date(asOfDate + 'T00:00:00') : asOfDate;

  let age = asOf.getFullYear() - dob.getFullYear();

  // Check if birthday hasn't occurred yet this year
  const monthDiff = asOf.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && asOf.getDate() < dob.getDate())) {
    age--;
  }

  return age;
}

/**
 * Determine the age band for compliance rules.
 *
 * @param age - Age in whole years
 * @returns Age band identifier
 */
export type AgeBand = '12-13' | '14-15' | '16-17' | '18+';

export function getAgeBand(age: number): AgeBand {
  if (age < 12) {
    throw new Error(`Age ${age} is below minimum employment age of 12`);
  }
  if (age <= 13) return '12-13';
  if (age <= 15) return '14-15';
  if (age <= 17) return '16-17';
  return '18+';
}

/**
 * Check if an employee has a birthday during a given week.
 * Useful for alerting when rules may change mid-week.
 *
 * @param dateOfBirth - Employee's date of birth
 * @param weekStartDate - Start of the week (Sunday)
 * @returns Object with birthday info if birthday falls in week
 */
export function checkBirthdayInWeek(
  dateOfBirth: string | Date,
  weekStartDate: string | Date
): { hasBirthday: boolean; birthdayDate?: Date; newAge?: number } {
  const dob = typeof dateOfBirth === 'string' ? new Date(dateOfBirth + 'T00:00:00') : dateOfBirth;
  const weekStart =
    typeof weekStartDate === 'string' ? new Date(weekStartDate + 'T00:00:00') : weekStartDate;
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  // Check each day of the week for a birthday
  for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
    if (d.getMonth() === dob.getMonth() && d.getDate() === dob.getDate()) {
      return {
        hasBirthday: true,
        birthdayDate: new Date(d),
        newAge: calculateAge(dob, d),
      };
    }
  }

  return { hasBirthday: false };
}

/**
 * Get ages for each day of a timesheet week.
 * Handles birthday mid-week correctly.
 *
 * @param dateOfBirth - Employee's date of birth
 * @param weekStartDate - Start of the week (Sunday)
 * @returns Map of date strings to ages
 */
export function getWeeklyAges(
  dateOfBirth: string | Date,
  weekStartDate: string | Date
): Map<string, number> {
  const weekStart =
    typeof weekStartDate === 'string' ? new Date(weekStartDate + 'T00:00:00') : weekStartDate;
  const ages = new Map<string, number>();

  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0]!;
    ages.set(dateStr, calculateAge(dateOfBirth, date));
  }

  return ages;
}
