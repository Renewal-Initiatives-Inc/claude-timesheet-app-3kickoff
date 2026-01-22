import { pgEnum } from 'drizzle-orm/pg-core';

// Employee status
export const employeeStatusEnum = pgEnum('employee_status', ['active', 'archived']);

// Document types
export const documentTypeEnum = pgEnum('document_type', [
  'parental_consent',
  'work_permit',
  'safety_training',
]);

// Supervisor requirement levels
export const supervisorRequiredEnum = pgEnum('supervisor_required', [
  'none',
  'for_minors',
  'always',
]);

// Timesheet status
export const timesheetStatusEnum = pgEnum('timesheet_status', [
  'open',
  'submitted',
  'approved',
  'rejected',
]);

// Compliance check result
export const complianceResultEnum = pgEnum('compliance_result', [
  'pass',
  'fail',
  'not_applicable',
]);
