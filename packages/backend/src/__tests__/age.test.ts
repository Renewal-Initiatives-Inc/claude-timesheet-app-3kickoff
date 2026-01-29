import { describe, it, expect } from 'vitest';
import { calculateAge, getAgeBand, checkBirthdayInWeek } from '../utils/age.js';

describe('Age Utilities', () => {
  describe('calculateAge', () => {
    it('should calculate age correctly for a birthday that has passed this year', () => {
      // Born Jan 15, 2010, as of Dec 1, 2025 = 15 years old
      expect(calculateAge('2010-01-15', '2025-12-01')).toBe(15);
    });

    it('should calculate age correctly for a birthday that has not passed this year', () => {
      // Born Dec 15, 2010, as of Jan 1, 2025 = 14 years old (birthday hasn't happened yet)
      expect(calculateAge('2010-12-15', '2025-01-01')).toBe(14);
    });

    it('should calculate age correctly on the birthday', () => {
      // Born Jun 15, 2010, as of Jun 15, 2025 = 15 years old
      expect(calculateAge('2010-06-15', '2025-06-15')).toBe(15);
    });

    it('should calculate age correctly for day before birthday', () => {
      // Born Jun 15, 2010, as of Jun 14, 2025 = 14 years old
      expect(calculateAge('2010-06-15', '2025-06-14')).toBe(14);
    });

    it('should handle leap year birthdays', () => {
      // Born Feb 29, 2000, as of Feb 28, 2025 = 24 years old
      expect(calculateAge('2000-02-29', '2025-02-28')).toBe(24);
      // Born Feb 29, 2000, as of Mar 1, 2025 = 25 years old
      expect(calculateAge('2000-02-29', '2025-03-01')).toBe(25);
    });
  });

  describe('getAgeBand', () => {
    it('should return 12-13 band for ages 12-13', () => {
      expect(getAgeBand(12)).toBe('12-13');
      expect(getAgeBand(13)).toBe('12-13');
    });

    it('should return 14-15 band for ages 14-15', () => {
      expect(getAgeBand(14)).toBe('14-15');
      expect(getAgeBand(15)).toBe('14-15');
    });

    it('should return 16-17 band for ages 16-17', () => {
      expect(getAgeBand(16)).toBe('16-17');
      expect(getAgeBand(17)).toBe('16-17');
    });

    it('should return 18+ band for ages 18 and above', () => {
      expect(getAgeBand(18)).toBe('18+');
      expect(getAgeBand(25)).toBe('18+');
      expect(getAgeBand(65)).toBe('18+');
    });

    it('should throw for ages under 12', () => {
      expect(() => getAgeBand(11)).toThrow('Age 11 is below minimum employment age of 12');
    });
  });

  describe('checkBirthdayInWeek', () => {
    it('should return hasBirthday true if birthday falls within the 7-day week', () => {
      // Week: June 15 (day 0) to June 21 (day 6)
      // Birthday on June 18 is day 3, definitely within
      const weekStart = '2025-06-15';
      const dob = '2010-06-18';
      const result = checkBirthdayInWeek(dob, weekStart);
      expect(result.hasBirthday).toBe(true);
      expect(result.newAge).toBe(15);
    });

    it('should return hasBirthday true if birthday is on week start day', () => {
      const weekStart = '2025-06-15';
      const dob = '2010-06-15';
      const result = checkBirthdayInWeek(dob, weekStart);
      expect(result.hasBirthday).toBe(true);
      expect(result.newAge).toBe(15);
    });

    it('should return hasBirthday false if birthday is clearly outside week', () => {
      // Week: June 15-21, birthday on June 25 (well after)
      const weekStart = '2025-06-15';
      const dob = '2010-06-25';
      const result = checkBirthdayInWeek(dob, weekStart);
      expect(result.hasBirthday).toBe(false);
    });

    it('should return correct new age when birthday is in week', () => {
      const weekStart = '2025-06-15';
      const dob = '2010-06-17'; // Turns 15 on June 17
      const result = checkBirthdayInWeek(dob, weekStart);
      expect(result.hasBirthday).toBe(true);
      expect(result.newAge).toBe(15);
      expect(result.birthdayDate).toBeDefined();
    });

    it('should include birthdayDate in result when birthday is found', () => {
      const weekStart = '2025-06-15';
      const dob = '2010-06-18';
      const result = checkBirthdayInWeek(dob, weekStart);
      expect(result.birthdayDate).toBeInstanceOf(Date);
    });

    it('should not include birthdayDate when no birthday in week', () => {
      const weekStart = '2025-06-15';
      const dob = '2010-06-25';
      const result = checkBirthdayInWeek(dob, weekStart);
      expect(result.birthdayDate).toBeUndefined();
    });
  });
});
