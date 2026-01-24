import { describe, it, expect } from 'vitest';
import type { ComplianceContext, EmployeeDocument } from '../../../services/compliance/types.js';
import type { AgeBand } from '../../../utils/age.js';
import {
  parentalConsentRule,
  parentalConsentNotRevokedRule,
  workPermitRequiredRule,
  workPermitNotExpiredRule,
  safetyTrainingRule,
} from '../../../services/compliance/rules/documentation.rules.js';

/**
 * Helper to create mock compliance context for testing.
 */
function createMockContext(
  options: {
    ageBand?: AgeBand;
    documents?: Partial<EmployeeDocument>[];
    checkDate?: string;
  } = {}
): ComplianceContext {
  const {
    ageBand = '14-15',
    documents = [],
    checkDate = '2024-06-15',
  } = options;

  const dailyAgeBands = new Map<string, AgeBand>([['2024-06-10', ageBand]]);
  const dailyAges = new Map<string, number>([
    ['2024-06-10', ageBand === '12-13' ? 13 : ageBand === '14-15' ? 15 : ageBand === '16-17' ? 17 : 18],
  ]);

  const fullDocuments: EmployeeDocument[] = documents.map((doc, i) => ({
    id: `doc-${i}`,
    employeeId: 'emp-1',
    type: doc.type ?? 'parental_consent',
    filePath: '/uploads/doc.pdf',
    uploadedAt: '2024-01-01T00:00:00.000Z',
    uploadedBy: 'admin',
    expiresAt: doc.expiresAt ?? null,
    invalidatedAt: doc.invalidatedAt ?? null,
  }));

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
    documents: fullDocuments,
    dailyAges,
    dailyAgeBands,
    dailyHours: new Map(),
    dailyEntries: new Map(),
    schoolDays: [],
    workDays: [],
    weeklyTotal: 0,
    isSchoolWeek: false,
    checkDate,
  };
}

describe('Documentation Rules', () => {
  describe('RULE-001: Parental Consent Required', () => {
    it('should return not_applicable for adults', () => {
      const context = createMockContext({ ageBand: '18+' });

      const result = parentalConsentRule.evaluate(context);

      expect(result.result).toBe('not_applicable');
      expect(result.ruleId).toBe('RULE-001');
    });

    it('should fail when no parental consent document exists', () => {
      const context = createMockContext({
        ageBand: '14-15',
        documents: [],
      });

      const result = parentalConsentRule.evaluate(context);

      expect(result.result).toBe('fail');
      expect(result.errorMessage).toContain('Test Employee');
    });

    it('should pass when valid parental consent exists', () => {
      const context = createMockContext({
        ageBand: '14-15',
        documents: [{ type: 'parental_consent' }],
      });

      const result = parentalConsentRule.evaluate(context);

      expect(result.result).toBe('pass');
    });

    it('should fail when only invalidated consent exists', () => {
      const context = createMockContext({
        ageBand: '14-15',
        documents: [{ type: 'parental_consent', invalidatedAt: '2024-05-01T00:00:00.000Z' }],
      });

      const result = parentalConsentRule.evaluate(context);

      expect(result.result).toBe('fail');
    });
  });

  describe('RULE-007: Parental Consent Not Revoked', () => {
    it('should return not_applicable for adults', () => {
      const context = createMockContext({ ageBand: '18+' });

      const result = parentalConsentNotRevokedRule.evaluate(context);

      expect(result.result).toBe('not_applicable');
    });

    it('should pass when no revoked consent exists', () => {
      const context = createMockContext({
        ageBand: '14-15',
        documents: [{ type: 'parental_consent' }],
      });

      const result = parentalConsentNotRevokedRule.evaluate(context);

      expect(result.result).toBe('pass');
    });

    it('should fail when consent is revoked with no replacement', () => {
      const context = createMockContext({
        ageBand: '14-15',
        documents: [{ type: 'parental_consent', invalidatedAt: '2024-05-01T00:00:00.000Z' }],
      });

      const result = parentalConsentNotRevokedRule.evaluate(context);

      expect(result.result).toBe('fail');
    });

    it('should pass when revoked consent has valid replacement', () => {
      const context = createMockContext({
        ageBand: '14-15',
        documents: [
          { type: 'parental_consent', invalidatedAt: '2024-05-01T00:00:00.000Z' },
          { type: 'parental_consent', invalidatedAt: null },
        ],
      });

      const result = parentalConsentNotRevokedRule.evaluate(context);

      expect(result.result).toBe('pass');
    });
  });

  describe('RULE-027: Work Permit Required', () => {
    it('should return not_applicable for ages 12-13', () => {
      const context = createMockContext({ ageBand: '12-13' });

      const result = workPermitRequiredRule.evaluate(context);

      expect(result.result).toBe('not_applicable');
    });

    it('should return not_applicable for adults', () => {
      const context = createMockContext({ ageBand: '18+' });

      const result = workPermitRequiredRule.evaluate(context);

      expect(result.result).toBe('not_applicable');
    });

    it('should fail when no work permit exists for 14-15', () => {
      const context = createMockContext({
        ageBand: '14-15',
        documents: [],
      });

      const result = workPermitRequiredRule.evaluate(context);

      expect(result.result).toBe('fail');
      expect(result.ruleId).toBe('RULE-027');
    });

    it('should fail when no work permit exists for 16-17', () => {
      const context = createMockContext({
        ageBand: '16-17',
        documents: [],
      });

      const result = workPermitRequiredRule.evaluate(context);

      expect(result.result).toBe('fail');
    });

    it('should pass when valid work permit exists', () => {
      const context = createMockContext({
        ageBand: '14-15',
        documents: [{ type: 'work_permit' }],
      });

      const result = workPermitRequiredRule.evaluate(context);

      expect(result.result).toBe('pass');
    });
  });

  describe('RULE-028: Work Permit Not Expired', () => {
    it('should return not_applicable for ages 12-13', () => {
      const context = createMockContext({ ageBand: '12-13' });

      const result = workPermitNotExpiredRule.evaluate(context);

      expect(result.result).toBe('not_applicable');
    });

    it('should return not_applicable when no permit exists', () => {
      const context = createMockContext({
        ageBand: '14-15',
        documents: [],
      });

      const result = workPermitNotExpiredRule.evaluate(context);

      expect(result.result).toBe('not_applicable');
    });

    it('should pass when permit has no expiration', () => {
      const context = createMockContext({
        ageBand: '14-15',
        documents: [{ type: 'work_permit', expiresAt: null }],
      });

      const result = workPermitNotExpiredRule.evaluate(context);

      expect(result.result).toBe('pass');
    });

    it('should pass when permit is not expired', () => {
      const context = createMockContext({
        ageBand: '14-15',
        documents: [{ type: 'work_permit', expiresAt: '2024-12-31' }],
        checkDate: '2024-06-15',
      });

      const result = workPermitNotExpiredRule.evaluate(context);

      expect(result.result).toBe('pass');
    });

    it('should fail when permit is expired', () => {
      const context = createMockContext({
        ageBand: '14-15',
        documents: [{ type: 'work_permit', expiresAt: '2024-01-01' }],
        checkDate: '2024-06-15',
      });

      const result = workPermitNotExpiredRule.evaluate(context);

      expect(result.result).toBe('fail');
      expect(result.details.message).toContain('expired');
    });
  });

  describe('RULE-030: Safety Training Required', () => {
    it('should return not_applicable for adults', () => {
      const context = createMockContext({ ageBand: '18+' });

      const result = safetyTrainingRule.evaluate(context);

      expect(result.result).toBe('not_applicable');
    });

    it('should fail when no safety training exists', () => {
      const context = createMockContext({
        ageBand: '14-15',
        documents: [],
      });

      const result = safetyTrainingRule.evaluate(context);

      expect(result.result).toBe('fail');
      expect(result.ruleId).toBe('RULE-030');
    });

    it('should pass when safety training exists', () => {
      const context = createMockContext({
        ageBand: '14-15',
        documents: [{ type: 'safety_training' }],
      });

      const result = safetyTrainingRule.evaluate(context);

      expect(result.result).toBe('pass');
    });

    it('should fail when safety training is invalidated', () => {
      const context = createMockContext({
        ageBand: '14-15',
        documents: [{ type: 'safety_training', invalidatedAt: '2024-05-01T00:00:00.000Z' }],
      });

      const result = safetyTrainingRule.evaluate(context);

      expect(result.result).toBe('fail');
    });
  });
});
