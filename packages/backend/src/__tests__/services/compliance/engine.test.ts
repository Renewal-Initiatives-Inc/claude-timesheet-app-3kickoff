import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ComplianceRule, ComplianceContext } from '../../../services/compliance/types.js';
import type { AgeBand } from '../../../utils/age.js';

// Mock the database module
vi.mock('../../../db/index.js', () => ({
  db: {
    query: {
      employees: {
        findFirst: vi.fn(),
      },
      employeeDocuments: {
        findMany: vi.fn(),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(),
    })),
  },
  schema: {
    employees: {},
    employeeDocuments: {},
    complianceCheckLogs: {},
  },
}));

// Mock timezone utility
vi.mock('../../../utils/timezone.js', () => ({
  getTodayET: vi.fn(() => '2024-06-15'),
}));

// Mock timesheet service
vi.mock('../../../services/timesheet.service.js', () => ({
  getTimesheetWithEntries: vi.fn(),
}));

// Mock age utility
vi.mock('../../../utils/age.js', () => ({
  calculateAge: vi.fn(() => 14),
  getAgeBand: vi.fn((age: number): AgeBand => {
    if (age >= 18) return '18+';
    if (age >= 16) return '16-17';
    if (age >= 14) return '14-15';
    return '12-13';
  }),
  getWeeklyAges: vi.fn((dob: string, weekStart: string) => {
    const ages = new Map<string, number>();
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart + 'T00:00:00');
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0]!;
      ages.set(dateStr, 14);
    }
    return ages;
  }),
}));

import {
  registerRules,
  clearRules,
  getRules,
  filterApplicableRules,
} from '../../../services/compliance/engine.js';

describe('Compliance Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRules();
  });

  afterEach(() => {
    clearRules();
  });

  describe('registerRules', () => {
    it('should register rules', () => {
      const mockRule: ComplianceRule = {
        id: 'TEST-001',
        name: 'Test Rule',
        category: 'hours',
        appliesToAgeBands: ['14-15'],
        evaluate: vi.fn(),
      };

      registerRules([mockRule]);

      const rules = getRules();
      expect(rules).toHaveLength(1);
      expect(rules[0]!.id).toBe('TEST-001');
    });

    it('should accumulate rules', () => {
      const rule1: ComplianceRule = {
        id: 'TEST-001',
        name: 'Test Rule 1',
        category: 'hours',
        appliesToAgeBands: ['14-15'],
        evaluate: vi.fn(),
      };

      const rule2: ComplianceRule = {
        id: 'TEST-002',
        name: 'Test Rule 2',
        category: 'documentation',
        appliesToAgeBands: ['12-13'],
        evaluate: vi.fn(),
      };

      registerRules([rule1]);
      registerRules([rule2]);

      const rules = getRules();
      expect(rules).toHaveLength(2);
    });
  });

  describe('clearRules', () => {
    it('should clear all registered rules', () => {
      const mockRule: ComplianceRule = {
        id: 'TEST-001',
        name: 'Test Rule',
        category: 'hours',
        appliesToAgeBands: ['14-15'],
        evaluate: vi.fn(),
      };

      registerRules([mockRule]);
      expect(getRules()).toHaveLength(1);

      clearRules();
      expect(getRules()).toHaveLength(0);
    });
  });

  describe('filterApplicableRules', () => {
    const createMockContext = (ageBands: AgeBand[]): ComplianceContext => {
      const dailyAgeBands = new Map<string, AgeBand>();
      ageBands.forEach((band, i) => {
        dailyAgeBands.set(`2024-06-${10 + i}`, band);
      });

      return {
        employee: {
          id: 'emp-1',
          name: 'Test Employee',
          email: 'test@example.com',
          dateOfBirth: '2010-01-01',
          isSupervisor: false,
        },
        timesheet: {
          id: 'ts-1',
          employeeId: 'emp-1',
          weekStartDate: '2024-06-09',
          status: 'open',
          submittedAt: null,
          reviewedBy: null,
          reviewedAt: null,
          supervisorNotes: null,
          createdAt: '2024-06-09T00:00:00.000Z',
          updatedAt: '2024-06-09T00:00:00.000Z',
          entries: [],
          totals: { daily: {}, weekly: 0 },
        },
        documents: [],
        dailyAges: new Map([['2024-06-10', 14]]),
        dailyAgeBands,
        dailyHours: new Map(),
        dailyEntries: new Map(),
        schoolDays: [],
        workDays: [],
        weeklyTotal: 0,
        isSchoolWeek: false,
        checkDate: '2024-06-15',
      };
    };

    it('should include rules with no age band restriction', () => {
      const rule: ComplianceRule = {
        id: 'TEST-001',
        name: 'Test Rule',
        category: 'documentation',
        appliesToAgeBands: [],
        evaluate: vi.fn(),
      };

      const context = createMockContext(['14-15']);
      const applicable = filterApplicableRules([rule], context);

      expect(applicable).toHaveLength(1);
    });

    it('should include rules matching employee age band', () => {
      const rule14_15: ComplianceRule = {
        id: 'TEST-001',
        name: 'Test Rule 14-15',
        category: 'hours',
        appliesToAgeBands: ['14-15'],
        evaluate: vi.fn(),
      };

      const rule12_13: ComplianceRule = {
        id: 'TEST-002',
        name: 'Test Rule 12-13',
        category: 'hours',
        appliesToAgeBands: ['12-13'],
        evaluate: vi.fn(),
      };

      const context = createMockContext(['14-15']);
      const applicable = filterApplicableRules([rule14_15, rule12_13], context);

      expect(applicable).toHaveLength(1);
      expect(applicable[0]!.id).toBe('TEST-001');
    });

    it('should include rules for birthday weeks with multiple age bands', () => {
      const rule14_15: ComplianceRule = {
        id: 'TEST-001',
        name: 'Test Rule 14-15',
        category: 'hours',
        appliesToAgeBands: ['14-15'],
        evaluate: vi.fn(),
      };

      const rule16_17: ComplianceRule = {
        id: 'TEST-002',
        name: 'Test Rule 16-17',
        category: 'hours',
        appliesToAgeBands: ['16-17'],
        evaluate: vi.fn(),
      };

      // Birthday week: some days 14-15, some days 16-17
      const context = createMockContext(['14-15', '14-15', '14-15', '16-17', '16-17']);
      const applicable = filterApplicableRules([rule14_15, rule16_17], context);

      expect(applicable).toHaveLength(2);
    });

    it('should exclude rules not matching any age band in the week', () => {
      const rule18Plus: ComplianceRule = {
        id: 'TEST-001',
        name: 'Test Rule 18+',
        category: 'hours',
        appliesToAgeBands: ['18+'],
        evaluate: vi.fn(),
      };

      const context = createMockContext(['14-15']);
      const applicable = filterApplicableRules([rule18Plus], context);

      expect(applicable).toHaveLength(0);
    });
  });
});
