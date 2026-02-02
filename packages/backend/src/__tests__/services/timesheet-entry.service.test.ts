import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module
vi.mock('../../db/index.js', () => ({
  db: {
    query: {
      timesheets: {
        findFirst: vi.fn(),
      },
      timesheetEntries: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      taskCodes: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(),
    })),
  },
  schema: {
    timesheets: {},
    timesheetEntries: {},
    taskCodes: {},
  },
}));

vi.mock('../../utils/timezone.js', () => ({
  isDefaultSchoolDay: vi.fn((date: string) => {
    // Mock school days as weekdays
    const d = new Date(date + 'T00:00:00');
    const day = d.getDay();
    return day !== 0 && day !== 6;
  }),
  timeToMinutes: vi.fn((time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours! * 60 + minutes!;
  }),
}));

vi.mock('../../services/timesheet.service.js', async (importOriginal) => {
  const actual = (await importOriginal()) as object;
  return {
    ...actual,
    getWeekDates: (weekStartDate: string) => {
      const dates: string[] = [];
      const start = new Date(weekStartDate + 'T00:00:00');
      for (let i = 0; i < 7; i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        dates.push(date.toISOString().split('T')[0]!);
      }
      return dates;
    },
  };
});

import { db } from '../../db/index.js';
import {
  createEntry,
  updateEntry,
  deleteEntry,
  getEntryById,
  getDailyTotals,
  getWeeklyTotal,
  calculateHours,
  getHourLimitsForAge,
  getAgeBand,
  previewEntryCompliance,
  TimesheetEntryError,
} from '../../services/timesheet-entry.service.js';

describe('Timesheet Entry Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateHours', () => {
    it('should calculate hours correctly', () => {
      expect(calculateHours('09:00', '17:00')).toBe(8);
      expect(calculateHours('08:30', '12:00')).toBe(3.5);
      expect(calculateHours('09:00', '09:30')).toBe(0.5);
    });

    it('should throw error if end time is before or equal to start time', () => {
      expect(() => calculateHours('17:00', '09:00')).toThrow(TimesheetEntryError);
      expect(() => calculateHours('09:00', '09:00')).toThrow(TimesheetEntryError);
    });
  });

  describe('getHourLimitsForAge', () => {
    it('should return correct limits for 12-13 age band', () => {
      const limits = getHourLimitsForAge(12);
      expect(limits.dailyLimit).toBe(4);
      expect(limits.weeklyLimit).toBe(24);

      const limits13 = getHourLimitsForAge(13);
      expect(limits13.dailyLimit).toBe(4);
      expect(limits13.weeklyLimit).toBe(24);
    });

    it('should return correct limits for 14-15 age band', () => {
      const limits = getHourLimitsForAge(14);
      expect(limits.dailyLimit).toBe(8);
      expect(limits.dailyLimitSchoolDay).toBe(3);
      expect(limits.weeklyLimit).toBe(40);
      expect(limits.weeklyLimitSchoolWeek).toBe(18);

      const limits15 = getHourLimitsForAge(15);
      expect(limits15.dailyLimit).toBe(8);
      expect(limits15.dailyLimitSchoolDay).toBe(3);
    });

    it('should return correct limits for 16-17 age band', () => {
      const limits = getHourLimitsForAge(16);
      expect(limits.dailyLimit).toBe(9);
      expect(limits.weeklyLimit).toBe(48);
      expect(limits.daysWorkedLimit).toBe(6);

      const limits17 = getHourLimitsForAge(17);
      expect(limits17.dailyLimit).toBe(9);
      expect(limits17.daysWorkedLimit).toBe(6);
    });

    it('should return no practical limits for 18+', () => {
      const limits = getHourLimitsForAge(18);
      expect(limits.dailyLimit).toBe(24);
      expect(limits.weeklyLimit).toBe(168);

      const limits25 = getHourLimitsForAge(25);
      expect(limits25.dailyLimit).toBe(24);
    });
  });

  describe('getAgeBand', () => {
    it('should return correct age band strings', () => {
      expect(getAgeBand(12)).toBe('12-13');
      expect(getAgeBand(13)).toBe('12-13');
      expect(getAgeBand(14)).toBe('14-15');
      expect(getAgeBand(15)).toBe('14-15');
      expect(getAgeBand(16)).toBe('16-17');
      expect(getAgeBand(17)).toBe('16-17');
      expect(getAgeBand(18)).toBe('18+');
      expect(getAgeBand(30)).toBe('18+');
    });
  });

  describe('createEntry', () => {
    it('should create entry successfully', async () => {
      const mockTimesheet = {
        id: 'ts-1',
        employeeId: 'emp-1',
        weekStartDate: '2024-06-09',
        status: 'open',
      };

      const mockTaskCode = {
        id: 'tc-1',
        code: 'F1',
        name: 'Field Work',
        isActive: true,
      };

      const newEntry = {
        id: 'entry-1',
        timesheetId: 'ts-1',
        workDate: '2024-06-10',
        taskCodeId: 'tc-1',
        startTime: '09:00',
        endTime: '17:00',
        hours: '8.00',
        isSchoolDay: true,
        schoolDayOverrideNote: null,
        supervisorPresentName: null,
        mealBreakConfirmed: null,
        createdAt: new Date(),
      };

      vi.mocked(db.query.timesheets.findFirst).mockResolvedValueOnce(mockTimesheet as never);
      vi.mocked(db.query.taskCodes.findFirst).mockResolvedValueOnce(mockTaskCode as never);
      vi.mocked(db.insert).mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([newEntry]),
        }),
      } as never);

      const result = await createEntry('ts-1', {
        workDate: '2024-06-10',
        taskCodeId: 'tc-1',
        startTime: '09:00',
        endTime: '17:00',
        isSchoolDay: true,
      });

      expect(result.id).toBe('entry-1');
      expect(result.hours).toBe('8.00');
    });

    it('should throw error for non-editable timesheet', async () => {
      const mockTimesheet = {
        id: 'ts-1',
        status: 'submitted',
      };

      vi.mocked(db.query.timesheets.findFirst).mockResolvedValueOnce(mockTimesheet as never);

      await expect(
        createEntry('ts-1', {
          workDate: '2024-06-10',
          taskCodeId: 'tc-1',
          startTime: '09:00',
          endTime: '17:00',
          isSchoolDay: true,
        })
      ).rejects.toThrow(TimesheetEntryError);
    });

    it('should throw error for date outside week', async () => {
      const mockTimesheet = {
        id: 'ts-1',
        weekStartDate: '2024-06-09',
        status: 'open',
      };

      vi.mocked(db.query.timesheets.findFirst).mockResolvedValueOnce(mockTimesheet as never);

      await expect(
        createEntry('ts-1', {
          workDate: '2024-06-20', // Outside the week
          taskCodeId: 'tc-1',
          startTime: '09:00',
          endTime: '17:00',
          isSchoolDay: true,
        })
      ).rejects.toThrow('Work date must be within the timesheet week');
    });

    it('should throw error for non-existent task code', async () => {
      const mockTimesheet = {
        id: 'ts-1',
        weekStartDate: '2024-06-09',
        status: 'open',
      };

      vi.mocked(db.query.timesheets.findFirst).mockResolvedValueOnce(mockTimesheet as never);
      vi.mocked(db.query.taskCodes.findFirst).mockResolvedValueOnce(null as never);

      await expect(
        createEntry('ts-1', {
          workDate: '2024-06-10',
          taskCodeId: 'non-existent',
          startTime: '09:00',
          endTime: '17:00',
          isSchoolDay: true,
        })
      ).rejects.toThrow('Task code not found');
    });
  });

  describe('updateEntry', () => {
    it('should update entry successfully', async () => {
      const existingEntry = {
        id: 'entry-1',
        timesheetId: 'ts-1',
        workDate: '2024-06-10',
        taskCodeId: 'tc-1',
        startTime: '09:00',
        endTime: '17:00',
        hours: '8.00',
        isSchoolDay: true,
        schoolDayOverrideNote: null,
        supervisorPresentName: null,
        mealBreakConfirmed: null,
        createdAt: new Date(),
        timesheet: {
          id: 'ts-1',
          status: 'open',
        },
      };

      const updatedEntry = {
        ...existingEntry,
        startTime: '08:00',
        endTime: '16:00',
        hours: '8.00',
      };

      vi.mocked(db.query.timesheetEntries.findFirst).mockResolvedValueOnce(existingEntry as never);
      vi.mocked(db.update).mockReturnValueOnce({
        set: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            returning: vi.fn().mockResolvedValueOnce([updatedEntry]),
          }),
        }),
      } as never);

      const result = await updateEntry('entry-1', {
        startTime: '08:00',
        endTime: '16:00',
      });

      expect(result.startTime).toBe('08:00');
    });

    it('should throw error for non-existent entry', async () => {
      vi.mocked(db.query.timesheetEntries.findFirst).mockResolvedValueOnce(null as never);

      await expect(updateEntry('non-existent', { startTime: '08:00' })).rejects.toThrow(
        'Entry not found'
      );
    });

    it('should throw error for non-editable timesheet', async () => {
      const existingEntry = {
        id: 'entry-1',
        timesheet: {
          id: 'ts-1',
          status: 'approved',
        },
      };

      vi.mocked(db.query.timesheetEntries.findFirst).mockResolvedValueOnce(existingEntry as never);

      await expect(updateEntry('entry-1', { startTime: '08:00' })).rejects.toThrow(
        'Cannot update entries on timesheet with status: approved'
      );
    });
  });

  describe('deleteEntry', () => {
    it('should delete entry successfully', async () => {
      const existingEntry = {
        id: 'entry-1',
        timesheetId: 'ts-1',
        timesheet: {
          id: 'ts-1',
          status: 'open',
        },
      };

      vi.mocked(db.query.timesheetEntries.findFirst).mockResolvedValueOnce(existingEntry as never);
      vi.mocked(db.delete).mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce(undefined),
      } as never);

      await expect(deleteEntry('entry-1')).resolves.not.toThrow();
      expect(db.delete).toHaveBeenCalled();
    });

    it('should throw error for non-existent entry', async () => {
      vi.mocked(db.query.timesheetEntries.findFirst).mockResolvedValueOnce(null as never);

      await expect(deleteEntry('non-existent')).rejects.toThrow('Entry not found');
    });

    it('should throw error for non-editable timesheet', async () => {
      const existingEntry = {
        id: 'entry-1',
        timesheet: {
          id: 'ts-1',
          status: 'submitted',
        },
      };

      vi.mocked(db.query.timesheetEntries.findFirst).mockResolvedValueOnce(existingEntry as never);

      await expect(deleteEntry('entry-1')).rejects.toThrow(
        'Cannot delete entries from timesheet with status: submitted'
      );
    });
  });

  describe('getEntryById', () => {
    it('should return entry if found', async () => {
      const mockEntry = {
        id: 'entry-1',
        timesheetId: 'ts-1',
        workDate: '2024-06-10',
        taskCodeId: 'tc-1',
        startTime: '09:00',
        endTime: '17:00',
        hours: '8.00',
        isSchoolDay: true,
        schoolDayOverrideNote: null,
        supervisorPresentName: null,
        mealBreakConfirmed: null,
        createdAt: new Date(),
      };

      vi.mocked(db.query.timesheetEntries.findFirst).mockResolvedValueOnce(mockEntry as never);

      const result = await getEntryById('entry-1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('entry-1');
    });

    it('should return null if not found', async () => {
      vi.mocked(db.query.timesheetEntries.findFirst).mockResolvedValueOnce(null as never);

      const result = await getEntryById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getDailyTotals', () => {
    it('should aggregate hours by date', async () => {
      const mockEntries = [
        { workDate: '2024-06-10', hours: '4.00' },
        { workDate: '2024-06-10', hours: '3.00' },
        { workDate: '2024-06-11', hours: '8.00' },
      ];

      vi.mocked(db.query.timesheetEntries.findMany).mockResolvedValueOnce(mockEntries as never);

      const result = await getDailyTotals('ts-1');

      expect(result['2024-06-10']).toBe(7);
      expect(result['2024-06-11']).toBe(8);
    });
  });

  describe('getWeeklyTotal', () => {
    it('should sum all entry hours', async () => {
      const mockEntries = [{ hours: '8.00' }, { hours: '8.00' }, { hours: '4.50' }];

      vi.mocked(db.query.timesheetEntries.findMany).mockResolvedValueOnce(mockEntries as never);

      const result = await getWeeklyTotal('ts-1');

      expect(result).toBe(20.5);
    });

    it('should return 0 for empty timesheet', async () => {
      vi.mocked(db.query.timesheetEntries.findMany).mockResolvedValueOnce([] as never);

      const result = await getWeeklyTotal('ts-1');

      expect(result).toBe(0);
    });
  });

  describe('previewEntryCompliance', () => {
    const mockTimesheetBase = {
      id: 'ts-1',
      employeeId: 'emp-1',
      weekStartDate: '2024-06-09',
      status: 'open',
      employee: {
        id: 'emp-1',
        dateOfBirth: '2011-01-15', // 13 years old in June 2024
      },
    };

    const mockTaskCode = {
      id: 'tc-1',
      code: 'C1',
      name: 'Customer Service',
      isActive: true,
      isHazardous: false,
      minAgeRequirement: null,
      supervisorRequired: 'never',
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should return no violations for a valid entry', async () => {
      vi.mocked(db.query.timesheets.findFirst).mockResolvedValueOnce(mockTimesheetBase as never);
      vi.mocked(db.query.taskCodes.findFirst).mockResolvedValueOnce(mockTaskCode as never);
      vi.mocked(db.query.timesheetEntries.findMany)
        .mockResolvedValueOnce([] as never) // Daily entries
        .mockResolvedValueOnce([] as never); // Weekly entries

      const result = await previewEntryCompliance('ts-1', {
        workDate: '2024-06-10',
        startTime: '16:00',
        endTime: '18:00',
        taskCodeId: 'tc-1',
        isSchoolDay: true,
      });

      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.proposedHours).toBe(2);
    });

    it('should return daily limit violation for 12-13 age band', async () => {
      vi.mocked(db.query.timesheets.findFirst).mockResolvedValueOnce(mockTimesheetBase as never);
      vi.mocked(db.query.taskCodes.findFirst).mockResolvedValueOnce(mockTaskCode as never);
      vi.mocked(db.query.timesheetEntries.findMany)
        .mockResolvedValueOnce([{ hours: '3.00' }] as never) // Already 3 hours today
        .mockResolvedValueOnce([{ hours: '3.00' }] as never); // Weekly entries

      const result = await previewEntryCompliance('ts-1', {
        workDate: '2024-06-10',
        startTime: '16:00',
        endTime: '18:00', // 2 more hours = 5 total, exceeds 4-hour limit
        taskCodeId: 'tc-1',
        isSchoolDay: true,
      });

      expect(result.valid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations.some((v) => v.message.includes('daily'))).toBe(true);
    });

    it('should return weekly limit violation for 12-13 age band', async () => {
      vi.mocked(db.query.timesheets.findFirst).mockResolvedValueOnce(mockTimesheetBase as never);
      vi.mocked(db.query.taskCodes.findFirst).mockResolvedValueOnce(mockTaskCode as never);
      vi.mocked(db.query.timesheetEntries.findMany)
        .mockResolvedValueOnce([] as never) // No daily hours yet
        .mockResolvedValueOnce([{ hours: '22.00' }] as never); // Already 22 hours this week

      const result = await previewEntryCompliance('ts-1', {
        workDate: '2024-06-10',
        startTime: '16:00',
        endTime: '19:00', // 3 more hours = 25 total, exceeds 24-hour limit
        taskCodeId: 'tc-1',
        isSchoolDay: true,
      });

      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.message.includes('weekly'))).toBe(true);
    });

    it('should return school hours violation for youth on school day', async () => {
      vi.mocked(db.query.timesheets.findFirst).mockResolvedValueOnce(mockTimesheetBase as never);
      vi.mocked(db.query.taskCodes.findFirst).mockResolvedValueOnce(mockTaskCode as never);
      vi.mocked(db.query.timesheetEntries.findMany)
        .mockResolvedValueOnce([] as never)
        .mockResolvedValueOnce([] as never);

      const result = await previewEntryCompliance('ts-1', {
        workDate: '2024-06-10',
        startTime: '10:00', // During school hours (7 AM - 3 PM)
        endTime: '12:00',
        taskCodeId: 'tc-1',
        isSchoolDay: true,
      });

      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.message.toLowerCase().includes('school'))).toBe(true);
    });

    it('should return correct remaining hours calculation', async () => {
      vi.mocked(db.query.timesheets.findFirst).mockResolvedValueOnce(mockTimesheetBase as never);
      vi.mocked(db.query.taskCodes.findFirst).mockResolvedValueOnce(mockTaskCode as never);
      vi.mocked(db.query.timesheetEntries.findMany)
        .mockResolvedValueOnce([{ hours: '2.00' }] as never) // 2 hours today
        .mockResolvedValueOnce([{ hours: '10.00' }] as never); // 10 hours this week

      const result = await previewEntryCompliance('ts-1', {
        workDate: '2024-06-10',
        startTime: '16:00',
        endTime: '17:00',
        taskCodeId: 'tc-1',
        isSchoolDay: true,
      });

      expect(result.limits.daily.current).toBe(2);
      expect(result.limits.daily.limit).toBe(4); // 12-13 age band
      expect(result.limits.daily.remaining).toBe(2);
      expect(result.limits.weekly.current).toBe(10);
      expect(result.limits.weekly.limit).toBe(24);
      expect(result.limits.weekly.remaining).toBe(14);
    });

    it('should return supervisor required for tasks requiring supervision', async () => {
      const taskWithSupervisor = {
        ...mockTaskCode,
        supervisorRequired: 'always',
      };

      vi.mocked(db.query.timesheets.findFirst).mockResolvedValueOnce(mockTimesheetBase as never);
      vi.mocked(db.query.taskCodes.findFirst).mockResolvedValueOnce(taskWithSupervisor as never);
      vi.mocked(db.query.timesheetEntries.findMany)
        .mockResolvedValueOnce([] as never)
        .mockResolvedValueOnce([] as never);

      const result = await previewEntryCompliance('ts-1', {
        workDate: '2024-06-10',
        startTime: '16:00',
        endTime: '18:00',
        taskCodeId: 'tc-1',
        isSchoolDay: true,
      });

      expect(result.requirements.supervisorRequired).toBe(true);
    });

    it('should return meal break required for shifts over 6 hours for youth', async () => {
      vi.mocked(db.query.timesheets.findFirst).mockResolvedValueOnce(mockTimesheetBase as never);
      vi.mocked(db.query.taskCodes.findFirst).mockResolvedValueOnce(mockTaskCode as never);
      vi.mocked(db.query.timesheetEntries.findMany)
        .mockResolvedValueOnce([] as never)
        .mockResolvedValueOnce([] as never);

      const result = await previewEntryCompliance('ts-1', {
        workDate: '2024-06-15', // Saturday - no school
        startTime: '09:00',
        endTime: '15:30', // 6.5 hours
        taskCodeId: 'tc-1',
        isSchoolDay: false,
      });

      expect(result.requirements.mealBreakRequired).toBe(true);
    });

    it('should return task age restriction violation for hazardous task', async () => {
      const hazardousTask = {
        ...mockTaskCode,
        isHazardous: true,
        minAgeRequirement: 18,
      };

      vi.mocked(db.query.timesheets.findFirst).mockResolvedValueOnce(mockTimesheetBase as never);
      vi.mocked(db.query.taskCodes.findFirst).mockResolvedValueOnce(hazardousTask as never);
      vi.mocked(db.query.timesheetEntries.findMany)
        .mockResolvedValueOnce([] as never)
        .mockResolvedValueOnce([] as never);

      const result = await previewEntryCompliance('ts-1', {
        workDate: '2024-06-15',
        startTime: '09:00',
        endTime: '11:00',
        taskCodeId: 'tc-1',
        isSchoolDay: false,
      });

      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.message.toLowerCase().includes('age'))).toBe(true);
    });
  });
});
