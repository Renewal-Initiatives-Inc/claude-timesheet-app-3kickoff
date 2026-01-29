import { pgTable, uuid, varchar, integer, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { complianceResultEnum } from './enums.js';
import { timesheets } from './timesheet.js';

// JSONB type for compliance details
export type ComplianceDetails = {
  ruleDescription: string;
  checkedValues: Record<string, unknown>;
  threshold?: number | string;
  actualValue?: number | string;
  message?: string;
};

export const complianceCheckLogs = pgTable(
  'compliance_check_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    timesheetId: uuid('timesheet_id')
      .notNull()
      .references(() => timesheets.id, { onDelete: 'restrict' }),
    ruleId: varchar('rule_id', { length: 20 }).notNull(), // e.g., "RULE-002"
    result: complianceResultEnum('result').notNull(),
    details: jsonb('details').$type<ComplianceDetails>().notNull(),
    checkedAt: timestamp('checked_at', { withTimezone: true }).notNull().defaultNow(),
    employeeAgeOnDate: integer('employee_age_on_date').notNull(),
  },
  (table) => ({
    // Index for fetching compliance logs by timesheet with time ordering
    timesheetCheckedAtIdx: index('idx_compliance_logs_timesheet_checked').on(
      table.timesheetId,
      table.checkedAt
    ),
    // Index for filtering by result (e.g., finding all failures)
    resultIdx: index('idx_compliance_logs_result').on(table.result),
  })
);

// Relations
export const complianceCheckLogsRelations = relations(complianceCheckLogs, ({ one }) => ({
  timesheet: one(timesheets, {
    fields: [complianceCheckLogs.timesheetId],
    references: [timesheets.id],
  }),
}));
