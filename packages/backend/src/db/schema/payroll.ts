import { pgTable, uuid, date, decimal, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { timesheets } from './timesheet.js';
import { employees } from './employee.js';

export const payrollRecords = pgTable(
  'payroll_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    timesheetId: uuid('timesheet_id')
      .notNull()
      .references(() => timesheets.id, { onDelete: 'restrict' })
      .unique(), // One payroll record per timesheet
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'restrict' }),
    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),
    agriculturalHours: decimal('agricultural_hours', { precision: 6, scale: 2 }).notNull(),
    agriculturalEarnings: decimal('agricultural_earnings', { precision: 10, scale: 2 }).notNull(),
    nonAgriculturalHours: decimal('non_agricultural_hours', { precision: 6, scale: 2 }).notNull(),
    nonAgriculturalEarnings: decimal('non_agricultural_earnings', {
      precision: 10,
      scale: 2,
    }).notNull(),
    overtimeHours: decimal('overtime_hours', { precision: 6, scale: 2 }).notNull(),
    overtimeEarnings: decimal('overtime_earnings', { precision: 10, scale: 2 }).notNull(),
    totalEarnings: decimal('total_earnings', { precision: 10, scale: 2 }).notNull(),
    calculatedAt: timestamp('calculated_at', { withTimezone: true }).notNull().defaultNow(),
    exportedAt: timestamp('exported_at', { withTimezone: true }),
  },
  (table) => ({
    // Index for payroll reports by employee and date range
    employeePeriodIdx: index('idx_payroll_employee_period').on(
      table.employeeId,
      table.periodStart,
      table.periodEnd
    ),
    // Index for finding records by calculation time (for exports)
    calculatedAtIdx: index('idx_payroll_calculated').on(table.calculatedAt),
  })
);

// Relations
export const payrollRecordsRelations = relations(payrollRecords, ({ one }) => ({
  timesheet: one(timesheets, {
    fields: [payrollRecords.timesheetId],
    references: [timesheets.id],
  }),
  employee: one(employees, {
    fields: [payrollRecords.employeeId],
    references: [employees.id],
  }),
}));
