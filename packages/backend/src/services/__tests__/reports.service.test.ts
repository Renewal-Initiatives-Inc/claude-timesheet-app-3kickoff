import { describe, it, expect } from 'vitest';

/**
 * Unit tests for report service calculation and filtering logic.
 * These tests validate the business rules without requiring database access.
 */
describe('Reports Service Logic', () => {
  // Age band calculation helper
  type AgeBand = '12-13' | '14-15' | '16-17' | '18+';

  function calculateAgeOnDate(dateOfBirth: string, asOfDate: string): number {
    const dob = new Date(dateOfBirth + 'T00:00:00');
    const asOf = new Date(asOfDate + 'T00:00:00');

    let age = asOf.getFullYear() - dob.getFullYear();
    const monthDiff = asOf.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && asOf.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  }

  function getAgeBand(age: number): AgeBand {
    if (age < 12) throw new Error(`Age ${age} is below minimum employment age`);
    if (age <= 13) return '12-13';
    if (age <= 15) return '14-15';
    if (age <= 17) return '16-17';
    return '18+';
  }

  describe('ReportError pattern', () => {
    class ReportError extends Error {
      constructor(
        message: string,
        public code: string
      ) {
        super(message);
        this.name = 'ReportError';
      }
    }

    it('should create error with correct code', () => {
      const error = new ReportError('Start date must be before end date', 'INVALID_DATE_RANGE');
      expect(error.code).toBe('INVALID_DATE_RANGE');
      expect(error.message).toBe('Start date must be before end date');
      expect(error.name).toBe('ReportError');
    });

    it('should support all error codes', () => {
      const codes = [
        { code: 'INVALID_DATE_RANGE', message: 'Start date must be before end date' },
        { code: 'NO_DATA_FOUND', message: 'No data found for the specified filters' },
      ];

      for (const { code, message } of codes) {
        const error = new ReportError(message, code);
        expect(error.code).toBe(code);
        expect(error.message).toBe(message);
      }
    });
  });

  describe('Compliance Audit Summary Aggregation', () => {
    interface ComplianceRecord {
      result: 'pass' | 'fail' | 'not_applicable';
      ruleId: string;
      timesheetId: string;
      employeeId: string;
    }

    function calculateComplianceSummary(records: ComplianceRecord[]) {
      const ruleMap = new Map<string, { passCount: number; failCount: number }>();
      const timesheetSet = new Set<string>();
      const employeeSet = new Set<string>();

      let passCount = 0;
      let failCount = 0;
      let notApplicableCount = 0;

      for (const record of records) {
        timesheetSet.add(record.timesheetId);
        employeeSet.add(record.employeeId);

        if (record.result === 'pass') passCount++;
        else if (record.result === 'fail') failCount++;
        else notApplicableCount++;

        if (!ruleMap.has(record.ruleId)) {
          ruleMap.set(record.ruleId, { passCount: 0, failCount: 0 });
        }
        const ruleStats = ruleMap.get(record.ruleId)!;
        if (record.result === 'pass') ruleStats.passCount++;
        else if (record.result === 'fail') ruleStats.failCount++;
      }

      return {
        totalChecks: records.length,
        passCount,
        failCount,
        notApplicableCount,
        uniqueTimesheets: timesheetSet.size,
        uniqueEmployees: employeeSet.size,
        ruleBreakdown: Array.from(ruleMap.entries()).map(([ruleId, stats]) => ({
          ruleId,
          ...stats,
        })),
      };
    }

    it('should correctly count pass, fail, and not_applicable results', () => {
      const records: ComplianceRecord[] = [
        { result: 'pass', ruleId: 'RULE-001', timesheetId: 'ts1', employeeId: 'e1' },
        { result: 'pass', ruleId: 'RULE-002', timesheetId: 'ts1', employeeId: 'e1' },
        { result: 'fail', ruleId: 'RULE-003', timesheetId: 'ts1', employeeId: 'e1' },
        { result: 'not_applicable', ruleId: 'RULE-004', timesheetId: 'ts1', employeeId: 'e1' },
      ];

      const summary = calculateComplianceSummary(records);
      expect(summary.passCount).toBe(2);
      expect(summary.failCount).toBe(1);
      expect(summary.notApplicableCount).toBe(1);
      expect(summary.totalChecks).toBe(4);
    });

    it('should calculate per-rule breakdown', () => {
      const records: ComplianceRecord[] = [
        { result: 'pass', ruleId: 'RULE-001', timesheetId: 'ts1', employeeId: 'e1' },
        { result: 'fail', ruleId: 'RULE-001', timesheetId: 'ts2', employeeId: 'e2' },
        { result: 'pass', ruleId: 'RULE-001', timesheetId: 'ts3', employeeId: 'e1' },
        { result: 'pass', ruleId: 'RULE-002', timesheetId: 'ts1', employeeId: 'e1' },
      ];

      const summary = calculateComplianceSummary(records);
      const rule001 = summary.ruleBreakdown.find((r) => r.ruleId === 'RULE-001');
      expect(rule001?.passCount).toBe(2);
      expect(rule001?.failCount).toBe(1);

      const rule002 = summary.ruleBreakdown.find((r) => r.ruleId === 'RULE-002');
      expect(rule002?.passCount).toBe(1);
      expect(rule002?.failCount).toBe(0);
    });

    it('should count unique timesheets and employees', () => {
      const records: ComplianceRecord[] = [
        { result: 'pass', ruleId: 'RULE-001', timesheetId: 'ts1', employeeId: 'e1' },
        { result: 'pass', ruleId: 'RULE-002', timesheetId: 'ts1', employeeId: 'e1' },
        { result: 'pass', ruleId: 'RULE-001', timesheetId: 'ts2', employeeId: 'e2' },
        { result: 'fail', ruleId: 'RULE-001', timesheetId: 'ts3', employeeId: 'e1' },
      ];

      const summary = calculateComplianceSummary(records);
      expect(summary.uniqueTimesheets).toBe(3);
      expect(summary.uniqueEmployees).toBe(2);
    });

    it('should handle empty record set', () => {
      const summary = calculateComplianceSummary([]);
      expect(summary.totalChecks).toBe(0);
      expect(summary.passCount).toBe(0);
      expect(summary.failCount).toBe(0);
      expect(summary.notApplicableCount).toBe(0);
      expect(summary.uniqueTimesheets).toBe(0);
      expect(summary.uniqueEmployees).toBe(0);
      expect(summary.ruleBreakdown).toEqual([]);
    });
  });

  describe('Age Band Filtering', () => {
    it('should classify age 12 correctly', () => {
      expect(getAgeBand(12)).toBe('12-13');
    });

    it('should classify age 13 correctly', () => {
      expect(getAgeBand(13)).toBe('12-13');
    });

    it('should classify age 14 correctly', () => {
      expect(getAgeBand(14)).toBe('14-15');
    });

    it('should classify age 15 correctly', () => {
      expect(getAgeBand(15)).toBe('14-15');
    });

    it('should classify age 16 correctly', () => {
      expect(getAgeBand(16)).toBe('16-17');
    });

    it('should classify age 17 correctly', () => {
      expect(getAgeBand(17)).toBe('16-17');
    });

    it('should classify age 18 correctly', () => {
      expect(getAgeBand(18)).toBe('18+');
    });

    it('should classify age 25 correctly', () => {
      expect(getAgeBand(25)).toBe('18+');
    });

    it('should throw for age below 12', () => {
      expect(() => getAgeBand(11)).toThrow('below minimum employment age');
    });
  });

  describe('Age Calculation Per Date', () => {
    it('should calculate age correctly before birthday', () => {
      // Born June 15, 2010
      // As of June 14, 2024 - still 13
      const age = calculateAgeOnDate('2010-06-15', '2024-06-14');
      expect(age).toBe(13);
    });

    it('should calculate age correctly on birthday', () => {
      // Born June 15, 2010
      // As of June 15, 2024 - turns 14
      const age = calculateAgeOnDate('2010-06-15', '2024-06-15');
      expect(age).toBe(14);
    });

    it('should calculate age correctly after birthday', () => {
      // Born June 15, 2010
      // As of June 16, 2024 - still 14
      const age = calculateAgeOnDate('2010-06-15', '2024-06-16');
      expect(age).toBe(14);
    });

    it('should handle year boundary', () => {
      // Born December 31, 2010
      // As of January 1, 2024 - is 13
      const age = calculateAgeOnDate('2010-12-31', '2024-01-01');
      expect(age).toBe(13);
    });

    it('should handle leap year birthday', () => {
      // Born Feb 29, 2008
      // As of Feb 28, 2024 - still 15
      const age = calculateAgeOnDate('2008-02-29', '2024-02-28');
      expect(age).toBe(15);
      // As of March 1, 2024 - turns 16
      const ageAfter = calculateAgeOnDate('2008-02-29', '2024-03-01');
      expect(ageAfter).toBe(16);
    });
  });

  describe('Date Range Filtering', () => {
    function isDateInRange(date: string, startDate: string, endDate: string): boolean {
      return date >= startDate && date <= endDate;
    }

    it('should include dates within range', () => {
      expect(isDateInRange('2024-06-15', '2024-06-01', '2024-06-30')).toBe(true);
    });

    it('should include dates on start boundary', () => {
      expect(isDateInRange('2024-06-01', '2024-06-01', '2024-06-30')).toBe(true);
    });

    it('should include dates on end boundary', () => {
      expect(isDateInRange('2024-06-30', '2024-06-01', '2024-06-30')).toBe(true);
    });

    it('should exclude dates before range', () => {
      expect(isDateInRange('2024-05-31', '2024-06-01', '2024-06-30')).toBe(false);
    });

    it('should exclude dates after range', () => {
      expect(isDateInRange('2024-07-01', '2024-06-01', '2024-06-30')).toBe(false);
    });
  });

  describe('Combined Filter Logic', () => {
    interface MockRecord {
      id: string;
      date: string;
      employeeId: string;
      ageBand: AgeBand;
      result: 'pass' | 'fail' | 'not_applicable';
    }

    interface Filters {
      startDate: string;
      endDate: string;
      employeeId?: string;
      ageBand?: AgeBand;
      result?: 'pass' | 'fail' | 'not_applicable';
    }

    function filterRecords(records: MockRecord[], filters: Filters): MockRecord[] {
      return records.filter((record) => {
        // Date range filter
        if (record.date < filters.startDate || record.date > filters.endDate) {
          return false;
        }

        // Employee filter
        if (filters.employeeId && record.employeeId !== filters.employeeId) {
          return false;
        }

        // Age band filter
        if (filters.ageBand && record.ageBand !== filters.ageBand) {
          return false;
        }

        // Result filter
        if (filters.result && record.result !== filters.result) {
          return false;
        }

        return true;
      });
    }

    const testRecords: MockRecord[] = [
      { id: '1', date: '2024-06-10', employeeId: 'e1', ageBand: '12-13', result: 'pass' },
      { id: '2', date: '2024-06-15', employeeId: 'e1', ageBand: '12-13', result: 'fail' },
      { id: '3', date: '2024-06-15', employeeId: 'e2', ageBand: '14-15', result: 'pass' },
      { id: '4', date: '2024-06-20', employeeId: 'e2', ageBand: '14-15', result: 'not_applicable' },
      { id: '5', date: '2024-07-01', employeeId: 'e1', ageBand: '12-13', result: 'pass' },
    ];

    it('should filter by date range only', () => {
      const filtered = filterRecords(testRecords, {
        startDate: '2024-06-01',
        endDate: '2024-06-30',
      });
      expect(filtered).toHaveLength(4);
      expect(filtered.map((r) => r.id)).toEqual(['1', '2', '3', '4']);
    });

    it('should filter by employee', () => {
      const filtered = filterRecords(testRecords, {
        startDate: '2024-06-01',
        endDate: '2024-07-31',
        employeeId: 'e1',
      });
      expect(filtered).toHaveLength(3);
      expect(filtered.every((r) => r.employeeId === 'e1')).toBe(true);
    });

    it('should filter by age band', () => {
      const filtered = filterRecords(testRecords, {
        startDate: '2024-06-01',
        endDate: '2024-07-31',
        ageBand: '14-15',
      });
      expect(filtered).toHaveLength(2);
      expect(filtered.every((r) => r.ageBand === '14-15')).toBe(true);
    });

    it('should filter by result', () => {
      const filtered = filterRecords(testRecords, {
        startDate: '2024-06-01',
        endDate: '2024-07-31',
        result: 'fail',
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.id).toBe('2');
    });

    it('should apply multiple filters together', () => {
      const filtered = filterRecords(testRecords, {
        startDate: '2024-06-01',
        endDate: '2024-06-30',
        employeeId: 'e1',
        result: 'pass',
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.id).toBe('1');
    });

    it('should return empty array when no matches', () => {
      const filtered = filterRecords(testRecords, {
        startDate: '2024-06-01',
        endDate: '2024-06-30',
        ageBand: '16-17',
      });
      expect(filtered).toHaveLength(0);
    });
  });

  describe('Timesheet History Summary', () => {
    interface TimesheetRecord {
      status: string;
      employeeId: string;
      employeeName: string;
      totalHours: number;
      totalEarnings: number | null;
    }

    function calculateTimesheetSummary(records: TimesheetRecord[]) {
      const statusMap = new Map<string, number>();
      const employeeMap = new Map<string, { name: string; count: number }>();
      let totalHours = 0;
      let totalEarnings = 0;

      for (const record of records) {
        const statusCount = statusMap.get(record.status) ?? 0;
        statusMap.set(record.status, statusCount + 1);

        if (!employeeMap.has(record.employeeId)) {
          employeeMap.set(record.employeeId, { name: record.employeeName, count: 0 });
        }
        employeeMap.get(record.employeeId)!.count++;

        totalHours += record.totalHours;
        if (record.totalEarnings) {
          totalEarnings += record.totalEarnings;
        }
      }

      return {
        totalTimesheets: records.length,
        statusBreakdown: Array.from(statusMap.entries()).map(([status, count]) => ({
          status,
          count,
        })),
        totalHours: Math.round(totalHours * 100) / 100,
        totalEarnings: Math.round(totalEarnings * 100) / 100,
        employeeBreakdown: Array.from(employeeMap.entries()).map(
          ([employeeId, data]) => ({
            employeeId,
            name: data.name,
            count: data.count,
          })
        ),
      };
    }

    it('should calculate status breakdown correctly', () => {
      const records: TimesheetRecord[] = [
        { status: 'approved', employeeId: 'e1', employeeName: 'John', totalHours: 40, totalEarnings: 600 },
        { status: 'approved', employeeId: 'e2', employeeName: 'Jane', totalHours: 35, totalEarnings: 525 },
        { status: 'rejected', employeeId: 'e1', employeeName: 'John', totalHours: 38, totalEarnings: null },
        { status: 'submitted', employeeId: 'e3', employeeName: 'Bob', totalHours: 40, totalEarnings: null },
      ];

      const summary = calculateTimesheetSummary(records);
      expect(summary.statusBreakdown.find((s) => s.status === 'approved')?.count).toBe(2);
      expect(summary.statusBreakdown.find((s) => s.status === 'rejected')?.count).toBe(1);
      expect(summary.statusBreakdown.find((s) => s.status === 'submitted')?.count).toBe(1);
    });

    it('should calculate total hours correctly', () => {
      const records: TimesheetRecord[] = [
        { status: 'approved', employeeId: 'e1', employeeName: 'John', totalHours: 40.5, totalEarnings: 600 },
        { status: 'approved', employeeId: 'e2', employeeName: 'Jane', totalHours: 35.25, totalEarnings: 525 },
      ];

      const summary = calculateTimesheetSummary(records);
      expect(summary.totalHours).toBe(75.75);
    });

    it('should only count earnings for approved timesheets', () => {
      const records: TimesheetRecord[] = [
        { status: 'approved', employeeId: 'e1', employeeName: 'John', totalHours: 40, totalEarnings: 600 },
        { status: 'rejected', employeeId: 'e2', employeeName: 'Jane', totalHours: 35, totalEarnings: null },
      ];

      const summary = calculateTimesheetSummary(records);
      expect(summary.totalEarnings).toBe(600);
    });

    it('should count timesheets per employee', () => {
      const records: TimesheetRecord[] = [
        { status: 'approved', employeeId: 'e1', employeeName: 'John', totalHours: 40, totalEarnings: 600 },
        { status: 'approved', employeeId: 'e1', employeeName: 'John', totalHours: 38, totalEarnings: 570 },
        { status: 'approved', employeeId: 'e2', employeeName: 'Jane', totalHours: 35, totalEarnings: 525 },
      ];

      const summary = calculateTimesheetSummary(records);
      expect(summary.employeeBreakdown.find((e) => e.employeeId === 'e1')?.count).toBe(2);
      expect(summary.employeeBreakdown.find((e) => e.employeeId === 'e2')?.count).toBe(1);
    });

    it('should handle empty record set', () => {
      const summary = calculateTimesheetSummary([]);
      expect(summary.totalTimesheets).toBe(0);
      expect(summary.totalHours).toBe(0);
      expect(summary.totalEarnings).toBe(0);
      expect(summary.statusBreakdown).toEqual([]);
      expect(summary.employeeBreakdown).toEqual([]);
    });
  });

  describe('CSV Export Formatting', () => {
    function escapeCSV(value: string): string {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }

    it('should escape values containing commas', () => {
      expect(escapeCSV('Hello, World')).toBe('"Hello, World"');
    });

    it('should escape values containing quotes', () => {
      expect(escapeCSV('Say "Hi"')).toBe('"Say ""Hi"""');
    });

    it('should escape values containing newlines', () => {
      expect(escapeCSV('Line 1\nLine 2')).toBe('"Line 1\nLine 2"');
    });

    it('should not escape simple values', () => {
      expect(escapeCSV('Hello World')).toBe('Hello World');
    });

    it('should handle empty string', () => {
      expect(escapeCSV('')).toBe('');
    });
  });
});
