import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { alertTypeEnum } from './enums.js';
import { employees } from './employee.js';

// Track sent email notifications to avoid duplicates
export const alertNotificationLogs = pgTable('alert_notification_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  alertType: alertTypeEnum('alert_type').notNull(),
  employeeId: uuid('employee_id')
    .notNull()
    .references(() => employees.id, { onDelete: 'cascade' }),
  sentTo: text('sent_to').notNull(), // supervisor email
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  alertKey: text('alert_key').notNull(), // unique key to prevent duplicates (e.g., "expiring_document:emp123:2024-03-15")
}, (table) => ({
  // Index for deduplication check (recent alerts for same key and recipient)
  alertKeyRecipientIdx: index('idx_alerts_key_recipient').on(
    table.alertKey,
    table.sentTo,
    table.sentAt
  ),
  // Index for employee alert history
  employeeSentAtIdx: index('idx_alerts_employee_sent').on(
    table.employeeId,
    table.sentAt
  ),
}));
