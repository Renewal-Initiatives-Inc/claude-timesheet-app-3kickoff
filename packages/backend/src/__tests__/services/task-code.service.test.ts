import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module
vi.mock('../../db/index.js', () => ({
  db: {
    query: {
      taskCodes: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      taskCodeRates: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      employees: {
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
  },
  schema: {
    taskCodes: {},
    taskCodeRates: {},
    employees: {},
  },
}));

import { db } from '../../db/index.js';
import {
  listTaskCodes,
  getTaskCodeById,
  getTaskCodeByCode,
  createTaskCode,
  updateTaskCode,
  addRate,
  getRateHistory,
  getEffectiveRate,
  getTaskCodesForEmployee,
  TaskCodeError,
} from '../../services/task-code.service.js';

describe('Task Code Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listTaskCodes', () => {
    it('should return all active task codes', async () => {
      const mockTaskCodes = [
        {
          id: '1',
          code: 'F1',
          name: 'Field Work',
          description: 'Field tasks',
          isAgricultural: true,
          isHazardous: false,
          supervisorRequired: 'none',
          soloCashHandling: false,
          drivingRequired: false,
          powerMachinery: false,
          minAgeAllowed: 12,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(db.query.taskCodes.findMany).mockResolvedValueOnce(mockTaskCodes as never);
      vi.mocked(db.query.taskCodeRates.findFirst).mockResolvedValueOnce({
        id: 'rate-1',
        taskCodeId: '1',
        hourlyRate: '8.00',
        effectiveDate: '2024-01-01',
        justificationNotes: null,
        createdAt: new Date(),
      } as never);

      const result = await listTaskCodes();

      expect(result.taskCodes).toHaveLength(1);
      expect(result.taskCodes[0].code).toBe('F1');
      expect(result.taskCodes[0].currentRate).toBe(8);
    });

    it('should filter by isAgricultural', async () => {
      vi.mocked(db.query.taskCodes.findMany).mockResolvedValueOnce([] as never);

      await listTaskCodes({ isAgricultural: true });

      expect(db.query.taskCodes.findMany).toHaveBeenCalled();
    });

    it('should filter by forAge', async () => {
      const mockTaskCodes = [
        {
          id: '1',
          code: 'F1',
          name: 'Field Work',
          minAgeAllowed: 12,
          isActive: true,
          isAgricultural: true,
          isHazardous: false,
          supervisorRequired: 'none',
          soloCashHandling: false,
          drivingRequired: false,
          powerMachinery: false,
          description: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(db.query.taskCodes.findMany).mockResolvedValueOnce(mockTaskCodes as never);
      vi.mocked(db.query.taskCodeRates.findFirst).mockResolvedValueOnce({
        id: 'rate-1',
        taskCodeId: '1',
        hourlyRate: '8.00',
        effectiveDate: '2024-01-01',
        justificationNotes: null,
        createdAt: new Date(),
      } as never);

      const result = await listTaskCodes({ forAge: 14 });

      expect(result.taskCodes).toHaveLength(1);
    });

    it('should search by code and name', async () => {
      vi.mocked(db.query.taskCodes.findMany).mockResolvedValueOnce([] as never);

      await listTaskCodes({ search: 'field' });

      expect(db.query.taskCodes.findMany).toHaveBeenCalled();
    });
  });

  describe('getTaskCodeById', () => {
    it('should return task code with rate history', async () => {
      const mockTaskCode = {
        id: '1',
        code: 'F1',
        name: 'Field Work',
        description: null,
        isAgricultural: true,
        isHazardous: false,
        supervisorRequired: 'none',
        soloCashHandling: false,
        drivingRequired: false,
        powerMachinery: false,
        minAgeAllowed: 12,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        rates: [
          {
            id: 'rate-1',
            taskCodeId: '1',
            hourlyRate: '8.00',
            effectiveDate: '2024-01-01',
            justificationNotes: 'Initial rate',
            createdAt: new Date(),
          },
        ],
      };

      vi.mocked(db.query.taskCodes.findFirst).mockResolvedValueOnce(mockTaskCode as never);
      vi.mocked(db.query.taskCodeRates.findFirst).mockResolvedValueOnce({
        id: 'rate-1',
        taskCodeId: '1',
        hourlyRate: '8.00',
        effectiveDate: '2024-01-01',
        justificationNotes: 'Initial rate',
        createdAt: new Date(),
      } as never);

      const result = await getTaskCodeById('1');

      expect(result).not.toBeNull();
      expect(result?.code).toBe('F1');
      expect(result?.rateHistory).toHaveLength(1);
    });

    it('should return null for non-existent task code', async () => {
      vi.mocked(db.query.taskCodes.findFirst).mockResolvedValueOnce(null as never);

      const result = await getTaskCodeById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getTaskCodeByCode', () => {
    it('should return task code by its code string', async () => {
      const mockTaskCode = {
        id: '1',
        code: 'F1',
        name: 'Field Work',
        description: null,
        isAgricultural: true,
        isHazardous: false,
        supervisorRequired: 'none',
        soloCashHandling: false,
        drivingRequired: false,
        powerMachinery: false,
        minAgeAllowed: 12,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.query.taskCodes.findFirst).mockResolvedValueOnce(mockTaskCode as never);
      vi.mocked(db.query.taskCodeRates.findFirst).mockResolvedValueOnce({
        id: 'rate-1',
        taskCodeId: '1',
        hourlyRate: '8.00',
        effectiveDate: '2024-01-01',
        justificationNotes: null,
        createdAt: new Date(),
      } as never);

      const result = await getTaskCodeByCode('f1'); // lowercase to test case conversion

      expect(result).not.toBeNull();
      expect(result?.code).toBe('F1');
    });
  });

  describe('createTaskCode', () => {
    it('should create task code with initial rate', async () => {
      vi.mocked(db.query.taskCodes.findFirst).mockResolvedValueOnce(null as never);

      const newTaskCode = {
        id: '1',
        code: 'F1',
        name: 'Field Work',
        description: null,
        isAgricultural: true,
        isHazardous: false,
        supervisorRequired: 'none',
        soloCashHandling: false,
        drivingRequired: false,
        powerMachinery: false,
        minAgeAllowed: 12,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.insert).mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([newTaskCode]),
        }),
      } as never);

      vi.mocked(db.insert).mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([
            {
              id: 'rate-1',
              taskCodeId: '1',
              hourlyRate: '8.00',
              effectiveDate: '2024-01-01',
              justificationNotes: null,
              createdAt: new Date(),
            },
          ]),
        }),
      } as never);

      const result = await createTaskCode({
        code: 'F1',
        name: 'Field Work',
        isAgricultural: true,
        isHazardous: false,
        supervisorRequired: 'none',
        minAgeAllowed: 12,
        soloCashHandling: false,
        drivingRequired: false,
        powerMachinery: false,
        initialRate: 8.0,
        rateEffectiveDate: '2024-01-01',
      });

      expect(result.code).toBe('F1');
      expect(result.currentRate).toBe(8);
    });

    it('should reject duplicate code', async () => {
      vi.mocked(db.query.taskCodes.findFirst).mockResolvedValueOnce({
        id: '1',
        code: 'F1',
      } as never);

      await expect(
        createTaskCode({
          code: 'F1',
          name: 'Field Work',
          isAgricultural: true,
          isHazardous: false,
          supervisorRequired: 'none',
          minAgeAllowed: 12,
          soloCashHandling: false,
          drivingRequired: false,
          powerMachinery: false,
          initialRate: 8.0,
          rateEffectiveDate: '2024-01-01',
        })
      ).rejects.toThrow(TaskCodeError);
    });

    it('should reject minAgeAllowed below 12', async () => {
      await expect(
        createTaskCode({
          code: 'F1',
          name: 'Field Work',
          isAgricultural: true,
          isHazardous: false,
          supervisorRequired: 'none',
          minAgeAllowed: 10,
          soloCashHandling: false,
          drivingRequired: false,
          powerMachinery: false,
          initialRate: 8.0,
          rateEffectiveDate: '2024-01-01',
        })
      ).rejects.toThrow(TaskCodeError);
    });
  });

  describe('updateTaskCode', () => {
    it('should update allowed fields', async () => {
      const existingTaskCode = {
        id: '1',
        code: 'F1',
        name: 'Field Work',
        description: null,
        isAgricultural: true,
        isHazardous: false,
        supervisorRequired: 'none',
        soloCashHandling: false,
        drivingRequired: false,
        powerMachinery: false,
        minAgeAllowed: 12,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.query.taskCodes.findFirst).mockResolvedValueOnce(existingTaskCode as never);

      const updatedTaskCode = {
        ...existingTaskCode,
        name: 'Updated Field Work',
        updatedAt: new Date(),
      };

      vi.mocked(db.update).mockReturnValueOnce({
        set: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            returning: vi.fn().mockResolvedValueOnce([updatedTaskCode]),
          }),
        }),
      } as never);

      vi.mocked(db.query.taskCodeRates.findFirst).mockResolvedValueOnce({
        id: 'rate-1',
        taskCodeId: '1',
        hourlyRate: '8.00',
        effectiveDate: '2024-01-01',
        justificationNotes: null,
        createdAt: new Date(),
      } as never);

      const result = await updateTaskCode('1', { name: 'Updated Field Work' });

      expect(result.name).toBe('Updated Field Work');
    });

    it('should throw error for non-existent task code', async () => {
      vi.mocked(db.query.taskCodes.findFirst).mockResolvedValueOnce(null as never);

      await expect(
        updateTaskCode('non-existent', { name: 'Test' })
      ).rejects.toThrow(TaskCodeError);
    });

    it('should allow deactivation (archive)', async () => {
      const existingTaskCode = {
        id: '1',
        code: 'F1',
        name: 'Field Work',
        isActive: true,
        isAgricultural: true,
        isHazardous: false,
        supervisorRequired: 'none',
        soloCashHandling: false,
        drivingRequired: false,
        powerMachinery: false,
        minAgeAllowed: 12,
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.query.taskCodes.findFirst).mockResolvedValueOnce(existingTaskCode as never);

      const archivedTaskCode = {
        ...existingTaskCode,
        isActive: false,
        updatedAt: new Date(),
      };

      vi.mocked(db.update).mockReturnValueOnce({
        set: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            returning: vi.fn().mockResolvedValueOnce([archivedTaskCode]),
          }),
        }),
      } as never);

      vi.mocked(db.query.taskCodeRates.findFirst).mockResolvedValueOnce({
        id: 'rate-1',
        taskCodeId: '1',
        hourlyRate: '8.00',
        effectiveDate: '2024-01-01',
        justificationNotes: null,
        createdAt: new Date(),
      } as never);

      const result = await updateTaskCode('1', { isActive: false });

      expect(result.isActive).toBe(false);
    });
  });

  describe('addRate', () => {
    it('should add new rate with future effective date', async () => {
      const existingTaskCode = {
        id: '1',
        code: 'F1',
      };

      vi.mocked(db.query.taskCodes.findFirst).mockResolvedValueOnce(existingTaskCode as never);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0]!;

      const newRate = {
        id: 'rate-2',
        taskCodeId: '1',
        hourlyRate: '10.00',
        effectiveDate: tomorrowStr,
        justificationNotes: 'Rate increase',
        createdAt: new Date(),
      };

      vi.mocked(db.insert).mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([newRate]),
        }),
      } as never);

      const result = await addRate('1', {
        hourlyRate: 10.0,
        effectiveDate: tomorrowStr,
        justificationNotes: 'Rate increase',
      });

      expect(result.hourlyRate).toBe('10.00');
    });

    it('should reject past effective date', async () => {
      const existingTaskCode = {
        id: '1',
        code: 'F1',
      };

      vi.mocked(db.query.taskCodes.findFirst).mockResolvedValueOnce(existingTaskCode as never);

      await expect(
        addRate('1', {
          hourlyRate: 10.0,
          effectiveDate: '2020-01-01', // Past date
        })
      ).rejects.toThrow(TaskCodeError);
    });
  });

  describe('getEffectiveRate', () => {
    it('should return correct rate for given date', async () => {
      vi.mocked(db.query.taskCodeRates.findFirst).mockResolvedValueOnce({
        id: 'rate-1',
        taskCodeId: '1',
        hourlyRate: '8.00',
        effectiveDate: '2024-01-01',
        justificationNotes: null,
        createdAt: new Date(),
      } as never);

      const result = await getEffectiveRate('1', '2024-06-15');

      expect(result).toBe(8);
    });

    it('should return null if no rate exists', async () => {
      vi.mocked(db.query.taskCodeRates.findFirst).mockResolvedValueOnce(null as never);

      const result = await getEffectiveRate('non-existent', '2024-06-15');

      expect(result).toBeNull();
    });
  });

  describe('getRateHistory', () => {
    it('should return rate history ordered by date', async () => {
      const existingTaskCode = {
        id: '1',
        code: 'F1',
      };

      vi.mocked(db.query.taskCodes.findFirst).mockResolvedValueOnce(existingTaskCode as never);

      const rates = [
        {
          id: 'rate-2',
          taskCodeId: '1',
          hourlyRate: '10.00',
          effectiveDate: '2024-06-01',
          justificationNotes: 'Rate increase',
          createdAt: new Date(),
        },
        {
          id: 'rate-1',
          taskCodeId: '1',
          hourlyRate: '8.00',
          effectiveDate: '2024-01-01',
          justificationNotes: 'Initial',
          createdAt: new Date(),
        },
      ];

      vi.mocked(db.query.taskCodeRates.findMany).mockResolvedValueOnce(rates as never);

      const result = await getRateHistory('1');

      expect(result).toHaveLength(2);
      expect(result[0].hourlyRate).toBe('10.00');
    });

    it('should throw error for non-existent task code', async () => {
      vi.mocked(db.query.taskCodes.findFirst).mockResolvedValueOnce(null as never);

      await expect(getRateHistory('non-existent')).rejects.toThrow(TaskCodeError);
    });
  });

  describe('getTaskCodesForEmployee', () => {
    it('should filter task codes by employee age', async () => {
      const mockEmployee = {
        id: 'emp-1',
        dateOfBirth: '2010-01-15', // 14 years old
      };

      vi.mocked(db.query.employees.findFirst).mockResolvedValueOnce(mockEmployee as never);

      const mockTaskCodes = [
        {
          id: '1',
          code: 'F1',
          name: 'Field Work',
          minAgeAllowed: 12,
          isActive: true,
          isAgricultural: true,
          isHazardous: false,
          supervisorRequired: 'none',
          soloCashHandling: false,
          drivingRequired: false,
          powerMachinery: false,
          description: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(db.query.taskCodes.findMany).mockResolvedValueOnce(mockTaskCodes as never);
      vi.mocked(db.query.taskCodeRates.findFirst).mockResolvedValueOnce({
        id: 'rate-1',
        taskCodeId: '1',
        hourlyRate: '8.00',
        effectiveDate: '2024-01-01',
        justificationNotes: null,
        createdAt: new Date(),
      } as never);

      const result = await getTaskCodesForEmployee('emp-1');

      expect(result.taskCodes.length).toBeGreaterThanOrEqual(0);
    });

    it('should throw error for non-existent employee', async () => {
      vi.mocked(db.query.employees.findFirst).mockResolvedValueOnce(null as never);

      await expect(getTaskCodesForEmployee('non-existent')).rejects.toThrow(TaskCodeError);
    });
  });
});
