import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module
vi.mock('../../db/index.js', () => ({
  db: {
    query: {
      timesheets: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      employees: {
        findFirst: vi.fn(),
      },
      timesheetEntries: {
        findMany: vi.fn(),
      },
      taskCodeRates: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(),
      })),
    })),
  },
  schema: {
    timesheets: {},
    employees: {},
    timesheetEntries: {},
    taskCodeRates: {},
  },
}));

vi.mock('../../utils/timezone.js', () => ({
  getTodayET: vi.fn(() => '2024-06-15'),
  getWeekStartDate: vi.fn((date: string) => date),
}));

import { db } from '../../db/index.js';
import {
  getOrCreateTimesheet,
  getTimesheetById,
  getEmployeeTimesheets,
  validateTimesheetAccess,
  isTimesheetEditable,
  getWeekDates,
  TimesheetError,
} from '../../services/timesheet.service.js';

describe('Timesheet Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getWeekDates', () => {
    it('should return 7 dates starting from week start', () => {
      const dates = getWeekDates('2024-06-09');

      expect(dates).toHaveLength(7);
      expect(dates[0]).toBe('2024-06-09');
      expect(dates[6]).toBe('2024-06-15');
    });
  });

  describe('getOrCreateTimesheet', () => {
    it('should return existing timesheet if found', async () => {
      const mockEmployee = {
        id: 'emp-1',
        name: 'Test Employee',
        status: 'active',
        dateOfBirth: '2008-01-01',
      };

      const mockTimesheet = {
        id: 'ts-1',
        employeeId: 'emp-1',
        weekStartDate: '2024-06-09',
        status: 'open',
        submittedAt: null,
        reviewedBy: null,
        reviewedAt: null,
        supervisorNotes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.query.employees.findFirst).mockResolvedValueOnce(mockEmployee as never);
      vi.mocked(db.query.timesheets.findFirst).mockResolvedValueOnce(mockTimesheet as never);

      const result = await getOrCreateTimesheet('emp-1', '2024-06-09');

      expect(result.id).toBe('ts-1');
      expect(result.weekStartDate).toBe('2024-06-09');
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('should create new timesheet if not found', async () => {
      const mockEmployee = {
        id: 'emp-1',
        name: 'Test Employee',
        status: 'active',
        dateOfBirth: '2008-01-01',
      };

      const newTimesheet = {
        id: 'ts-new',
        employeeId: 'emp-1',
        weekStartDate: '2024-06-09',
        status: 'open',
        submittedAt: null,
        reviewedBy: null,
        reviewedAt: null,
        supervisorNotes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.query.employees.findFirst).mockResolvedValueOnce(mockEmployee as never);
      vi.mocked(db.query.timesheets.findFirst).mockResolvedValueOnce(null as never);
      vi.mocked(db.insert).mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([newTimesheet]),
        }),
      } as never);

      const result = await getOrCreateTimesheet('emp-1', '2024-06-09');

      expect(result.id).toBe('ts-new');
      expect(result.status).toBe('open');
      expect(db.insert).toHaveBeenCalled();
    });

    it('should throw error for non-Sunday week start date', async () => {
      await expect(getOrCreateTimesheet('emp-1', '2024-06-10')).rejects.toThrow(TimesheetError);

      await expect(getOrCreateTimesheet('emp-1', '2024-06-10')).rejects.toThrow(
        'Week start date must be a Sunday'
      );
    });

    it('should throw error for non-existent employee', async () => {
      vi.mocked(db.query.employees.findFirst).mockResolvedValueOnce(null as never);

      await expect(getOrCreateTimesheet('non-existent', '2024-06-09')).rejects.toThrow(
        TimesheetError
      );
    });
  });

  describe('getTimesheetById', () => {
    it('should return timesheet if found', async () => {
      const mockTimesheet = {
        id: 'ts-1',
        employeeId: 'emp-1',
        weekStartDate: '2024-06-09',
        status: 'open',
        submittedAt: null,
        reviewedBy: null,
        reviewedAt: null,
        supervisorNotes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.query.timesheets.findFirst).mockResolvedValueOnce(mockTimesheet as never);

      const result = await getTimesheetById('ts-1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('ts-1');
    });

    it('should return null if not found', async () => {
      vi.mocked(db.query.timesheets.findFirst).mockResolvedValueOnce(null as never);

      const result = await getTimesheetById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getEmployeeTimesheets', () => {
    it('should return employee timesheets with pagination', async () => {
      const mockTimesheets = [
        {
          id: 'ts-1',
          employeeId: 'emp-1',
          weekStartDate: '2024-06-09',
          status: 'open',
          submittedAt: null,
          reviewedBy: null,
          reviewedAt: null,
          supervisorNotes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'ts-2',
          employeeId: 'emp-1',
          weekStartDate: '2024-06-02',
          status: 'approved',
          submittedAt: new Date(),
          reviewedBy: 'sup-1',
          reviewedAt: new Date(),
          supervisorNotes: 'Approved',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(db.query.timesheets.findMany)
        .mockResolvedValueOnce(mockTimesheets as never)
        .mockResolvedValueOnce(mockTimesheets as never);

      const result = await getEmployeeTimesheets('emp-1', { limit: 10, offset: 0 });

      expect(result.timesheets).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by status', async () => {
      vi.mocked(db.query.timesheets.findMany)
        .mockResolvedValueOnce([] as never)
        .mockResolvedValueOnce([] as never);

      await getEmployeeTimesheets('emp-1', { status: ['open'] });

      expect(db.query.timesheets.findMany).toHaveBeenCalled();
    });
  });

  describe('validateTimesheetAccess', () => {
    it('should return true if employee owns timesheet', async () => {
      const mockTimesheet = {
        id: 'ts-1',
        employeeId: 'emp-1',
      };

      vi.mocked(db.query.timesheets.findFirst).mockResolvedValueOnce(mockTimesheet as never);

      const result = await validateTimesheetAccess('ts-1', 'emp-1');

      expect(result).toBe(true);
    });

    it('should return false if employee does not own timesheet', async () => {
      const mockTimesheet = {
        id: 'ts-1',
        employeeId: 'emp-other',
      };

      vi.mocked(db.query.timesheets.findFirst).mockResolvedValueOnce(mockTimesheet as never);

      const result = await validateTimesheetAccess('ts-1', 'emp-1');

      expect(result).toBe(false);
    });

    it('should throw error if timesheet not found', async () => {
      vi.mocked(db.query.timesheets.findFirst).mockResolvedValueOnce(null as never);

      await expect(validateTimesheetAccess('non-existent', 'emp-1')).rejects.toThrow(
        TimesheetError
      );
    });
  });

  describe('isTimesheetEditable', () => {
    it('should return true for open timesheet', () => {
      const timesheet = {
        id: 'ts-1',
        employeeId: 'emp-1',
        weekStartDate: '2024-06-09',
        status: 'open' as const,
        submittedAt: null,
        reviewedBy: null,
        reviewedAt: null,
        supervisorNotes: null,
        createdAt: '2024-06-09T00:00:00.000Z',
        updatedAt: '2024-06-09T00:00:00.000Z',
      };

      expect(isTimesheetEditable(timesheet)).toBe(true);
    });

    it('should return false for submitted timesheet', () => {
      const timesheet = {
        id: 'ts-1',
        employeeId: 'emp-1',
        weekStartDate: '2024-06-09',
        status: 'submitted' as const,
        submittedAt: '2024-06-10T00:00:00.000Z',
        reviewedBy: null,
        reviewedAt: null,
        supervisorNotes: null,
        createdAt: '2024-06-09T00:00:00.000Z',
        updatedAt: '2024-06-09T00:00:00.000Z',
      };

      expect(isTimesheetEditable(timesheet)).toBe(false);
    });

    it('should return false for approved timesheet', () => {
      const timesheet = {
        id: 'ts-1',
        employeeId: 'emp-1',
        weekStartDate: '2024-06-09',
        status: 'approved' as const,
        submittedAt: '2024-06-10T00:00:00.000Z',
        reviewedBy: 'sup-1',
        reviewedAt: '2024-06-11T00:00:00.000Z',
        supervisorNotes: null,
        createdAt: '2024-06-09T00:00:00.000Z',
        updatedAt: '2024-06-09T00:00:00.000Z',
      };

      expect(isTimesheetEditable(timesheet)).toBe(false);
    });
  });
});
