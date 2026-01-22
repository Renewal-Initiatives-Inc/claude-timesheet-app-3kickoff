import { describe, it, expect } from 'vitest';
import { calculateAge, getAgeBand, checkBirthdayInWeek, getWeeklyAges } from '../../utils/age.js';

describe('calculateAge', () => {
  it('calculates age correctly before birthday', () => {
    expect(calculateAge('2010-06-15', '2024-06-14')).toBe(13);
  });

  it('calculates age correctly on birthday', () => {
    expect(calculateAge('2010-06-15', '2024-06-15')).toBe(14);
  });

  it('calculates age correctly after birthday', () => {
    expect(calculateAge('2010-06-15', '2024-06-16')).toBe(14);
  });

  it('handles year boundary correctly', () => {
    expect(calculateAge('2010-12-31', '2024-01-01')).toBe(13);
    expect(calculateAge('2010-01-01', '2024-01-01')).toBe(14);
  });

  it('handles leap year birthdays', () => {
    expect(calculateAge('2008-02-29', '2024-02-28')).toBe(15);
    expect(calculateAge('2008-02-29', '2024-02-29')).toBe(16);
    expect(calculateAge('2008-02-29', '2024-03-01')).toBe(16);
  });

  it('accepts Date objects', () => {
    expect(calculateAge(new Date('2010-06-15'), new Date('2024-06-15'))).toBe(14);
  });

  it('handles exact age boundaries for compliance', () => {
    // Age 12 boundary
    expect(calculateAge('2012-01-15', '2024-01-14')).toBe(11);
    expect(calculateAge('2012-01-15', '2024-01-15')).toBe(12);

    // Age 14 boundary
    expect(calculateAge('2010-01-15', '2024-01-14')).toBe(13);
    expect(calculateAge('2010-01-15', '2024-01-15')).toBe(14);

    // Age 16 boundary
    expect(calculateAge('2008-01-15', '2024-01-14')).toBe(15);
    expect(calculateAge('2008-01-15', '2024-01-15')).toBe(16);

    // Age 18 boundary
    expect(calculateAge('2006-01-15', '2024-01-14')).toBe(17);
    expect(calculateAge('2006-01-15', '2024-01-15')).toBe(18);
  });
});

describe('getAgeBand', () => {
  it('returns 12-13 for ages 12 and 13', () => {
    expect(getAgeBand(12)).toBe('12-13');
    expect(getAgeBand(13)).toBe('12-13');
  });

  it('returns 14-15 for ages 14 and 15', () => {
    expect(getAgeBand(14)).toBe('14-15');
    expect(getAgeBand(15)).toBe('14-15');
  });

  it('returns 16-17 for ages 16 and 17', () => {
    expect(getAgeBand(16)).toBe('16-17');
    expect(getAgeBand(17)).toBe('16-17');
  });

  it('returns 18+ for ages 18 and above', () => {
    expect(getAgeBand(18)).toBe('18+');
    expect(getAgeBand(25)).toBe('18+');
    expect(getAgeBand(65)).toBe('18+');
  });

  it('throws for ages below 12', () => {
    expect(() => getAgeBand(11)).toThrow('below minimum employment age');
    expect(() => getAgeBand(0)).toThrow('below minimum employment age');
    expect(() => getAgeBand(-1)).toThrow('below minimum employment age');
  });
});

describe('checkBirthdayInWeek', () => {
  it('detects birthday within week', () => {
    // Week: Sun Jun 9 - Sat Jun 15, 2024
    // Birthday: Jun 15
    const result = checkBirthdayInWeek('2010-06-15', '2024-06-09');
    expect(result.hasBirthday).toBe(true);
    expect(result.newAge).toBe(14);
  });

  it('returns false when no birthday in week', () => {
    // Week: Sun Jun 2 - Sat Jun 8 (week before birthday)
    const result = checkBirthdayInWeek('2010-06-15', '2024-06-02');
    expect(result.hasBirthday).toBe(false);
    expect(result.newAge).toBeUndefined();
  });

  it('handles birthday on first day of week (Sunday)', () => {
    // Week starts on Jun 9, birthday is Jun 9
    const result = checkBirthdayInWeek('2010-06-09', '2024-06-09');
    expect(result.hasBirthday).toBe(true);
  });

  it('handles birthday on last day of week (Saturday)', () => {
    // Week: Sun Jun 9 - Sat Jun 15, birthday is Jun 15
    const result = checkBirthdayInWeek('2010-06-15', '2024-06-09');
    expect(result.hasBirthday).toBe(true);
  });

  it('handles year boundary birthdays', () => {
    // Week: Sun Dec 29, 2024 - Sat Jan 4, 2025
    // Birthday: Jan 1
    const result = checkBirthdayInWeek('2010-01-01', '2024-12-29');
    expect(result.hasBirthday).toBe(true);
    expect(result.newAge).toBe(15);
  });
});

describe('getWeeklyAges', () => {
  it('returns same age for entire week when no birthday', () => {
    // Birthday in January, week in June
    const ages = getWeeklyAges('2010-01-15', '2024-06-09');
    const agesArray = Array.from(ages.values());
    expect(new Set(agesArray).size).toBe(1); // All same age
    expect(agesArray[0]).toBe(14);
  });

  it('returns different ages when birthday falls mid-week', () => {
    // Birthday is June 12 (Wednesday), week starts June 9 (Sunday)
    const ages = getWeeklyAges('2010-06-12', '2024-06-09');

    expect(ages.get('2024-06-09')).toBe(13); // Sunday before birthday
    expect(ages.get('2024-06-10')).toBe(13); // Monday
    expect(ages.get('2024-06-11')).toBe(13); // Tuesday
    expect(ages.get('2024-06-12')).toBe(14); // Wednesday - BIRTHDAY
    expect(ages.get('2024-06-13')).toBe(14); // Thursday
    expect(ages.get('2024-06-14')).toBe(14); // Friday
    expect(ages.get('2024-06-15')).toBe(14); // Saturday
  });

  it('returns 7 entries for the week', () => {
    const ages = getWeeklyAges('2010-06-15', '2024-06-09');
    expect(ages.size).toBe(7);
  });

  it('handles age band transition (13->14) mid-week', () => {
    // This is critical for compliance: rules change when turning 14
    const ages = getWeeklyAges('2010-06-12', '2024-06-09');

    // Before birthday: 12-13 rules apply
    expect(ages.get('2024-06-11')).toBe(13);
    // On and after birthday: 14-15 rules apply
    expect(ages.get('2024-06-12')).toBe(14);
  });

  it('handles age band transition (17->18) mid-week', () => {
    // This is critical: adult rules apply after 18th birthday
    const ages = getWeeklyAges('2006-06-12', '2024-06-09');

    // Before birthday: 16-17 rules apply
    expect(ages.get('2024-06-11')).toBe(17);
    // On and after birthday: 18+ rules (no restrictions)
    expect(ages.get('2024-06-12')).toBe(18);
  });
});
