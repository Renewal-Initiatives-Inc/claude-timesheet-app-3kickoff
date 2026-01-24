import { describe, it, expect } from 'vitest';
import {
  approveTimesheetSchema,
  rejectTimesheetSchema,
  unlockWeekSchema,
  reviewQueueQuerySchema,
} from '../validation/supervisor.schema.js';

describe('Supervisor Validation Schemas', () => {
  describe('approveTimesheetSchema', () => {
    it('should accept empty object (no notes)', () => {
      const result = approveTimesheetSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should accept with optional notes', () => {
      const result = approveTimesheetSchema.safeParse({
        notes: 'Good work on this timesheet!',
      });
      expect(result.success).toBe(true);
      expect(result.data?.notes).toBe('Good work on this timesheet!');
    });

    it('should reject notes over 2000 characters', () => {
      const result = approveTimesheetSchema.safeParse({
        notes: 'a'.repeat(2001),
      });
      expect(result.success).toBe(false);
    });

    it('should accept notes at max length (2000 chars)', () => {
      const result = approveTimesheetSchema.safeParse({
        notes: 'a'.repeat(2000),
      });
      expect(result.success).toBe(true);
    });
  });

  describe('rejectTimesheetSchema', () => {
    it('should require notes field', () => {
      const result = rejectTimesheetSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject notes shorter than 10 characters', () => {
      const result = rejectTimesheetSchema.safeParse({
        notes: 'Too short',
      });
      expect(result.success).toBe(false);
    });

    it('should accept notes at minimum length (10 chars)', () => {
      const result = rejectTimesheetSchema.safeParse({
        notes: '1234567890',
      });
      expect(result.success).toBe(true);
    });

    it('should accept valid rejection notes', () => {
      const result = rejectTimesheetSchema.safeParse({
        notes: 'Please correct the hours on Monday - they exceed the daily limit.',
      });
      expect(result.success).toBe(true);
    });

    it('should reject notes over 2000 characters', () => {
      const result = rejectTimesheetSchema.safeParse({
        notes: 'a'.repeat(2001),
      });
      expect(result.success).toBe(false);
    });

    it('should accept notes at max length (2000 chars)', () => {
      const result = rejectTimesheetSchema.safeParse({
        notes: 'a'.repeat(2000),
      });
      expect(result.success).toBe(true);
    });
  });

  describe('unlockWeekSchema', () => {
    it('should require employeeId', () => {
      const result = unlockWeekSchema.safeParse({
        weekStartDate: '2025-01-19',
      });
      expect(result.success).toBe(false);
    });

    it('should require weekStartDate', () => {
      const result = unlockWeekSchema.safeParse({
        employeeId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(false);
    });

    it('should accept valid unlock request', () => {
      const result = unlockWeekSchema.safeParse({
        employeeId: '550e8400-e29b-41d4-a716-446655440000',
        weekStartDate: '2025-01-19', // A Sunday
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID for employeeId', () => {
      const result = unlockWeekSchema.safeParse({
        employeeId: 'not-a-uuid',
        weekStartDate: '2025-01-19',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid date format', () => {
      const result = unlockWeekSchema.safeParse({
        employeeId: '550e8400-e29b-41d4-a716-446655440000',
        weekStartDate: '01-19-2025',
      });
      expect(result.success).toBe(false);
    });

    it('should reject weekStartDate that is not a Sunday', () => {
      const result = unlockWeekSchema.safeParse({
        employeeId: '550e8400-e29b-41d4-a716-446655440000',
        weekStartDate: '2025-01-20', // Monday
      });
      expect(result.success).toBe(false);
    });

    it('should accept weekStartDate that is a Sunday', () => {
      const result = unlockWeekSchema.safeParse({
        employeeId: '550e8400-e29b-41d4-a716-446655440000',
        weekStartDate: '2025-01-26', // Sunday
      });
      expect(result.success).toBe(true);
    });
  });

  describe('reviewQueueQuerySchema', () => {
    it('should accept empty object', () => {
      const result = reviewQueueQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      expect(result.data?.employeeId).toBeUndefined();
    });

    it('should accept valid employeeId filter', () => {
      const result = reviewQueueQuerySchema.safeParse({
        employeeId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
      expect(result.data?.employeeId).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should reject invalid UUID for employeeId', () => {
      const result = reviewQueueQuerySchema.safeParse({
        employeeId: 'not-a-uuid',
      });
      expect(result.success).toBe(false);
    });
  });
});
