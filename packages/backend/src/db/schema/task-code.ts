import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  decimal,
  date,
  timestamp,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { supervisorRequiredEnum } from './enums';

export const taskCodes = pgTable('task_codes', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 10 }).notNull().unique(), // e.g., "F1", "R2"
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  isAgricultural: boolean('is_agricultural').notNull().default(false),
  isHazardous: boolean('is_hazardous').notNull().default(false),
  supervisorRequired: supervisorRequiredEnum('supervisor_required').notNull().default('none'),
  soloCashHandling: boolean('solo_cash_handling').notNull().default(false),
  drivingRequired: boolean('driving_required').notNull().default(false),
  powerMachinery: boolean('power_machinery').notNull().default(false),
  minAgeAllowed: integer('min_age_allowed').notNull().default(12),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const taskCodeRates = pgTable('task_code_rates', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskCodeId: uuid('task_code_id')
    .notNull()
    .references(() => taskCodes.id, { onDelete: 'restrict' }),
  hourlyRate: decimal('hourly_rate', { precision: 10, scale: 2 }).notNull(),
  effectiveDate: date('effective_date').notNull(),
  justificationNotes: text('justification_notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Relations
export const taskCodesRelations = relations(taskCodes, ({ many }) => ({
  rates: many(taskCodeRates),
}));

export const taskCodeRatesRelations = relations(taskCodeRates, ({ one }) => ({
  taskCode: one(taskCodes, {
    fields: [taskCodeRates.taskCodeId],
    references: [taskCodes.id],
  }),
}));
