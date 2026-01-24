import {
  pgTable,
  uuid,
  date,
  time,
  decimal,
  boolean,
  text,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { timesheetStatusEnum } from './enums';
import { employees } from './employee';
import { taskCodes } from './task-code';

export const timesheets = pgTable('timesheets', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: uuid('employee_id')
    .notNull()
    .references(() => employees.id, { onDelete: 'restrict' }),
  weekStartDate: date('week_start_date').notNull(), // Sunday
  status: timesheetStatusEnum('status').notNull().default('open'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  reviewedBy: uuid('reviewed_by').references(() => employees.id, { onDelete: 'restrict' }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  supervisorNotes: text('supervisor_notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  // Composite index for efficient employee timesheet lookups
  employeeWeekIdx: index('idx_timesheets_employee_week').on(
    table.employeeId,
    table.weekStartDate
  ),
  // Index for pending review queue queries
  statusIdx: index('idx_timesheets_status').on(table.status),
}));

export const timesheetEntries = pgTable('timesheet_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  timesheetId: uuid('timesheet_id')
    .notNull()
    .references(() => timesheets.id, { onDelete: 'restrict' }),
  workDate: date('work_date').notNull(),
  taskCodeId: uuid('task_code_id')
    .notNull()
    .references(() => taskCodes.id, { onDelete: 'restrict' }),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  hours: decimal('hours', { precision: 4, scale: 2 }).notNull(), // calculated
  isSchoolDay: boolean('is_school_day').notNull().default(false),
  schoolDayOverrideNote: text('school_day_override_note'),
  supervisorPresentName: text('supervisor_present_name'),
  mealBreakConfirmed: boolean('meal_break_confirmed'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Relations
export const timesheetsRelations = relations(timesheets, ({ one, many }) => ({
  employee: one(employees, {
    fields: [timesheets.employeeId],
    references: [employees.id],
  }),
  reviewer: one(employees, {
    fields: [timesheets.reviewedBy],
    references: [employees.id],
  }),
  entries: many(timesheetEntries),
}));

export const timesheetEntriesRelations = relations(timesheetEntries, ({ one }) => ({
  timesheet: one(timesheets, {
    fields: [timesheetEntries.timesheetId],
    references: [timesheets.id],
  }),
  taskCode: one(taskCodes, {
    fields: [timesheetEntries.taskCodeId],
    references: [taskCodes.id],
  }),
}));
