/**
 * Error messages and remediation guidance for compliance rules.
 *
 * Messages are designed to be:
 * - Clear and actionable
 * - Written for young employees (ages 12+)
 * - Specific about what went wrong and how to fix it
 */

/**
 * Format a date for display (e.g., "Monday, January 15").
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format time for display (e.g., "3:30 PM").
 */
function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const h = hours ?? 0;
  const m = minutes ?? 0;
  const period = h >= 12 ? 'PM' : 'AM';
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayHour}:${m.toString().padStart(2, '0')} ${period}`;
}

// ============================================================================
// Documentation Rules
// ============================================================================

export const RULE_001_MESSAGE = {
  message: (employeeName: string) =>
    `Parental consent required: ${employeeName} is under 18 and requires a valid parental consent form on file before submitting timesheets.`,
  remediation: 'Please contact your supervisor to upload the parental consent form.',
};

export const RULE_007_MESSAGE = {
  message: () =>
    'Parental consent has been revoked. Your account access has been suspended until new consent is provided.',
  remediation: 'Please have your parent/guardian provide new consent to your supervisor.',
};

export const RULE_027_MESSAGE = {
  message: (age: number) =>
    `Work permit required: Massachusetts law requires a Youth Employment Permit for workers ages 14-17. You are currently ${age} years old.`,
  remediation: 'Please obtain a work permit from your school and have your supervisor upload it before submitting.',
};

export const RULE_028_MESSAGE = {
  message: (expiresAt: string) =>
    `Work permit expired: Your work permit expired on ${formatDate(expiresAt)}. You cannot submit timesheets until a valid permit is on file.`,
  remediation: 'Please obtain a new work permit from your school and have your supervisor upload it.',
};

export const RULE_030_MESSAGE = {
  message: () =>
    'Safety training required: You must complete safety training before submitting your first timesheet.',
  remediation: 'Please contact your supervisor to complete and document your safety training.',
};

// ============================================================================
// Hour Limit Rules
// ============================================================================

export const RULE_002_MESSAGE = {
  message: (date: string, hours: number, limit: number) =>
    `Daily hour limit exceeded: Ages 12-13 may work a maximum of ${limit} hours per day. You entered ${hours.toFixed(1)} hours on ${formatDate(date)}.`,
  remediation: (limit: number) =>
    `Please reduce hours to ${limit} or less for that day.`,
};

export const RULE_003_MESSAGE = {
  message: (hours: number, limit: number) =>
    `Weekly hour limit exceeded: Ages 12-13 may work a maximum of ${limit} hours per week. Your total is ${hours.toFixed(1)} hours.`,
  remediation: (limit: number) =>
    `Please reduce your total weekly hours to ${limit} or less.`,
};

export const RULE_008_MESSAGE = {
  message: (date: string, hours: number, limit: number) =>
    `School day hour limit exceeded: Ages 14-15 may work a maximum of ${limit} hours on school days. You entered ${hours.toFixed(1)} hours on ${formatDate(date)}.`,
  remediation: (limit: number) =>
    `Please reduce hours to ${limit} or less, or verify this is not a school day and update the school day designation with a note.`,
};

export const RULE_009_MESSAGE = {
  message: (hours: number, limit: number) =>
    `School week hour limit exceeded: Ages 14-15 may work a maximum of ${limit} hours during school weeks. Your total is ${hours.toFixed(1)} hours.`,
  remediation: (limit: number) =>
    `Please reduce your total weekly hours to ${limit} or less.`,
};

export const RULE_014_MESSAGE = {
  message: (date: string, hours: number, limit: number) =>
    `Daily hour limit exceeded: Ages 16-17 may work a maximum of ${limit} hours per day. You entered ${hours.toFixed(1)} hours on ${formatDate(date)}.`,
  remediation: (limit: number) =>
    `Please reduce hours to ${limit} or less for that day.`,
};

export const RULE_015_MESSAGE = {
  message: (hours: number, limit: number) =>
    `Weekly hour limit exceeded: Ages 16-17 may work a maximum of ${limit} hours per week. Your total is ${hours.toFixed(1)} hours.`,
  remediation: (limit: number) =>
    `Please reduce your total weekly hours to ${limit} or less.`,
};

export const RULE_018_MESSAGE = {
  message: (daysWorked: number, limit: number) =>
    `Day count limit exceeded: Ages 16-17 may work a maximum of ${limit} days per week. You have entries on ${daysWorked} days.`,
  remediation: (limit: number) =>
    `Please remove entries so you work no more than ${limit} days this week.`,
};

export const RULE_032_MESSAGE = {
  message: (date: string, hours: number, limit: number) =>
    `Daily hour limit exceeded: Ages 14-15 may work a maximum of ${limit} hours on non-school days. You entered ${hours.toFixed(1)} hours on ${formatDate(date)}.`,
  remediation: (limit: number) =>
    `Please reduce hours to ${limit} or less for that day.`,
};

export const RULE_033_MESSAGE = {
  message: (hours: number, limit: number) =>
    `Weekly hour limit exceeded: Ages 14-15 may work a maximum of ${limit} hours during non-school weeks. Your total is ${hours.toFixed(1)} hours.`,
  remediation: (limit: number) =>
    `Please reduce your total weekly hours to ${limit} or less.`,
};

// ============================================================================
// Time Window Rules
// ============================================================================

export const RULE_004_MESSAGE = {
  message: (date: string, startTime: string, endTime: string) =>
    `School hours violation: Ages 12-13 cannot work during school hours (7:00 AM - 3:00 PM) on school days. You logged work from ${formatTime(startTime)} to ${formatTime(endTime)} on ${formatDate(date)}.`,
  remediation:
    'Please adjust start/end times to be outside 7:00 AM - 3:00 PM, or mark this as a non-school day with an explanatory note.',
};

export const RULE_010_MESSAGE = {
  message: (date: string, startTime: string, endTime: string) =>
    `School hours violation: Ages 14-15 cannot work during school hours (7:00 AM - 3:00 PM) on school days. You logged work from ${formatTime(startTime)} to ${formatTime(endTime)} on ${formatDate(date)}.`,
  remediation:
    'Please adjust start/end times to be outside 7:00 AM - 3:00 PM, or mark this as a non-school day with an explanatory note.',
};

export const RULE_011_MESSAGE = {
  message: (date: string, endTime: string, windowEnd: string, isSummer: boolean) =>
    `Work window violation: Ages 14-15 may only work between 7:00 AM and ${windowEnd} ${isSummer ? '(summer hours)' : ''}. You logged work ending at ${formatTime(endTime)} on ${formatDate(date)}.`,
  remediation: (windowEnd: string) =>
    `Please adjust your end time to be before ${windowEnd}.`,
};

export const RULE_016_MESSAGE = {
  message: (date: string, endTime: string) =>
    `School night violation: Ages 16-17 cannot work past 10:00 PM on nights before school days. You logged work ending at ${formatTime(endTime)} on ${formatDate(date)}.`,
  remediation:
    'Please adjust your end time to be before 10:00 PM.',
};

export const RULE_017_MESSAGE = {
  message: (date: string, startTime: string, endTime: string) =>
    `Work window violation: Ages 16-17 may only work between 6:00 AM and 11:30 PM. You logged work from ${formatTime(startTime)} to ${formatTime(endTime)} on ${formatDate(date)}.`,
  remediation:
    'Please adjust your times to be between 6:00 AM and 11:30 PM.',
};

export const RULE_034_MESSAGE = {
  message: (date: string, startTime: string, endTime: string) =>
    `School hours violation: Ages 16-17 cannot work during school hours (7:00 AM - 3:00 PM) on school days. You logged work from ${formatTime(startTime)} to ${formatTime(endTime)} on ${formatDate(date)}.`,
  remediation:
    'Please adjust start/end times to be outside 7:00 AM - 3:00 PM, or mark this as a non-school day with an explanatory note.',
};

export const RULE_036_MESSAGE = {
  message: (date: string, startTime: string, endTime: string) =>
    `School hours violation: Workers under 18 cannot work during school hours (7:00 AM - 3:00 PM) on school days. You logged work from ${formatTime(startTime)} to ${formatTime(endTime)} on ${formatDate(date)}.`,
  remediation:
    'Please adjust start/end times to be outside 7:00 AM - 3:00 PM, or mark this as a non-school day with an explanatory note.',
};

// ============================================================================
// Task Restriction Rules
// ============================================================================

export const RULE_005_MESSAGE = {
  message: (taskCode: string, taskName: string, minAge: number, employeeAge: number, date: string) =>
    `Task age restriction: Task ${taskCode} (${taskName}) requires a minimum age of ${minAge}. You were ${employeeAge} years old on ${formatDate(date)}.`,
  remediation:
    'Please remove this task from your timesheet or speak with your supervisor about reassignment.',
};

export const RULE_020_MESSAGE = {
  message: (taskCode: string, taskName: string) =>
    `Power machinery restriction: Task ${taskCode} (${taskName}) involves power machinery, which is prohibited for workers under 18.`,
  remediation:
    'Please remove this task from your timesheet. Power machinery work is not permitted for minors.',
};

export const RULE_021_MESSAGE = {
  message: (taskCode: string, taskName: string) =>
    `Driving restriction: Task ${taskCode} (${taskName}) requires driving, which is prohibited for workers under 18.`,
  remediation:
    'Please remove this task from your timesheet. Driving tasks are not permitted for minors.',
};

export const RULE_022_MESSAGE = {
  message: (taskCode: string, taskName: string, age: number) =>
    `Cash handling restriction: Task ${taskCode} (${taskName}) involves solo cash handling, which is prohibited for workers under 14. You are ${age} years old.`,
  remediation:
    'Please remove this task from your timesheet or speak with your supervisor about supervised cash handling.',
};

export const RULE_024_MESSAGE = {
  message: (taskCode: string, taskName: string) =>
    `Hazardous task restriction: Task ${taskCode} (${taskName}) is classified as hazardous and prohibited for workers under 18.`,
  remediation:
    'Please remove this task from your timesheet. Hazardous work is not permitted for minors.',
};

export const RULE_029_MESSAGE = {
  message: (taskCode: string, taskName: string, date: string) =>
    `Supervisor attestation required: Task ${taskCode} (${taskName}) on ${formatDate(date)} requires a supervisor to be present. No supervisor name was recorded.`,
  remediation:
    'Please edit the entry and add the name of the supervisor who was present during this task.',
};

// ============================================================================
// Break Rules
// ============================================================================

export const RULE_025_MESSAGE = {
  message: (date: string, hours: number) =>
    `Meal break required: You worked ${hours.toFixed(1)} hours on ${formatDate(date)}. Workers under 18 must take a 30-minute meal break when working more than 6 hours.`,
  remediation:
    'Please confirm that you took a 30-minute meal break by checking the meal break confirmation box for that day.',
};

export { formatDate, formatTime };
