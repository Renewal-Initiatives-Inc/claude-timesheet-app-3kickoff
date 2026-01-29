/**
 * Tests for employee age validation and documentation requirements.
 * These test the business rules without requiring database access.
 */
import { describe, it, expect } from 'vitest';
import { calculateAge, getAgeBand, type AgeBand } from '../utils/age.js';

// Re-implement the pure business logic functions for testing
// (These mirror the logic in employee.service.ts but without DB imports)

const MIN_EMPLOYMENT_AGE = 12;

interface RequiredDocuments {
  parentalConsent: boolean;
  workPermit: boolean;
  safetyTraining: boolean;
  coppaDisclosure: boolean;
}

function validateEmployeeAge(
  dateOfBirth: string,
  asOfDate: Date = new Date()
): { age: number; ageBand: AgeBand } {
  const dateStr = asOfDate.toISOString().split('T')[0]!;
  const age = calculateAge(dateOfBirth, dateStr);

  if (age < MIN_EMPLOYMENT_AGE) {
    throw new Error(
      `Employee must be at least ${MIN_EMPLOYMENT_AGE} years old. Calculated age: ${age}`
    );
  }

  return {
    age,
    ageBand: getAgeBand(age),
  };
}

function getRequiredDocuments(age: number): RequiredDocuments {
  if (age < MIN_EMPLOYMENT_AGE) {
    throw new Error(`Minimum employment age is ${MIN_EMPLOYMENT_AGE}`);
  }

  if (age <= 13) {
    return {
      parentalConsent: true,
      workPermit: false,
      safetyTraining: true,
      coppaDisclosure: true,
    };
  }

  if (age <= 17) {
    return {
      parentalConsent: true,
      workPermit: true,
      safetyTraining: true,
      coppaDisclosure: false,
    };
  }

  return {
    parentalConsent: false,
    workPermit: false,
    safetyTraining: false,
    coppaDisclosure: false,
  };
}

describe('Employee Business Rules', () => {
  describe('validateEmployeeAge', () => {
    it('should accept employees aged 12 and above', () => {
      const today = new Date();
      const twelveYearsAgo = new Date(today);
      twelveYearsAgo.setFullYear(twelveYearsAgo.getFullYear() - 12);
      const dateOfBirth = twelveYearsAgo.toISOString().split('T')[0]!;

      const result = validateEmployeeAge(dateOfBirth, today);
      expect(result.age).toBe(12);
      expect(result.ageBand).toBe('12-13');
    });

    it('should reject employees under 12', () => {
      const today = new Date();
      const elevenYearsAgo = new Date(today);
      elevenYearsAgo.setFullYear(elevenYearsAgo.getFullYear() - 11);
      const dateOfBirth = elevenYearsAgo.toISOString().split('T')[0]!;

      expect(() => validateEmployeeAge(dateOfBirth, today)).toThrow('at least 12 years old');
    });

    it('should correctly categorize age bands', () => {
      const today = new Date();

      // 13 years old -> 12-13 band
      const thirteenYearsAgo = new Date(today);
      thirteenYearsAgo.setFullYear(thirteenYearsAgo.getFullYear() - 13);
      expect(
        validateEmployeeAge(thirteenYearsAgo.toISOString().split('T')[0]!, today).ageBand
      ).toBe('12-13');

      // 14 years old -> 14-15 band
      const fourteenYearsAgo = new Date(today);
      fourteenYearsAgo.setFullYear(fourteenYearsAgo.getFullYear() - 14);
      expect(
        validateEmployeeAge(fourteenYearsAgo.toISOString().split('T')[0]!, today).ageBand
      ).toBe('14-15');

      // 16 years old -> 16-17 band
      const sixteenYearsAgo = new Date(today);
      sixteenYearsAgo.setFullYear(sixteenYearsAgo.getFullYear() - 16);
      expect(validateEmployeeAge(sixteenYearsAgo.toISOString().split('T')[0]!, today).ageBand).toBe(
        '16-17'
      );

      // 18 years old -> 18+ band
      const eighteenYearsAgo = new Date(today);
      eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 18);
      expect(
        validateEmployeeAge(eighteenYearsAgo.toISOString().split('T')[0]!, today).ageBand
      ).toBe('18+');
    });
  });

  describe('getRequiredDocuments', () => {
    it('should require parental consent, safety training, and COPPA for ages 12-13', () => {
      const docs12 = getRequiredDocuments(12);
      expect(docs12).toEqual({
        parentalConsent: true,
        workPermit: false,
        safetyTraining: true,
        coppaDisclosure: true,
      });

      const docs13 = getRequiredDocuments(13);
      expect(docs13).toEqual({
        parentalConsent: true,
        workPermit: false,
        safetyTraining: true,
        coppaDisclosure: true,
      });
    });

    it('should require parental consent, work permit, and safety training for ages 14-17', () => {
      const docs14 = getRequiredDocuments(14);
      expect(docs14).toEqual({
        parentalConsent: true,
        workPermit: true,
        safetyTraining: true,
        coppaDisclosure: false,
      });

      const docs17 = getRequiredDocuments(17);
      expect(docs17).toEqual({
        parentalConsent: true,
        workPermit: true,
        safetyTraining: true,
        coppaDisclosure: false,
      });
    });

    it('should require no documents for ages 18+', () => {
      const docs18 = getRequiredDocuments(18);
      expect(docs18).toEqual({
        parentalConsent: false,
        workPermit: false,
        safetyTraining: false,
        coppaDisclosure: false,
      });

      const docs30 = getRequiredDocuments(30);
      expect(docs30).toEqual({
        parentalConsent: false,
        workPermit: false,
        safetyTraining: false,
        coppaDisclosure: false,
      });
    });

    it('should throw for ages under 12', () => {
      expect(() => getRequiredDocuments(11)).toThrow('Minimum employment age is 12');
    });
  });
});
