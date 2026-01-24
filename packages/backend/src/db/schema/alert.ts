import {
  pgTable,
  uuid,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { alertTypeEnum } from './enums';
import { employees } from './employee';

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
});
