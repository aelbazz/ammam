import { cvDateSortKey, formatCvDate, formatCvDateRange } from './cv-date.util';

describe('cv-date.util', () => {
  describe('formatCvDate', () => {
    it('normalizes real seeded "Mon YYYY" strings', () => {
      expect(formatCvDate('Jan 2024')).toBe('Jan 2024');
      expect(formatCvDate('Aug 2017')).toBe('Aug 2017');
      expect(formatCvDate('Sep 2022')).toBe('Sep 2022');
    });

    it('passes bare years through unchanged', () => {
      expect(formatCvDate('2024')).toBe('2024');
    });

    it('passes an already-unambiguous range through unchanged', () => {
      expect(formatCvDate('2019-2024')).toBe('2019-2024');
    });

    it('never throws on null/undefined/empty, returning an empty string', () => {
      expect(formatCvDate(null)).toBe('');
      expect(formatCvDate(undefined)).toBe('');
      expect(formatCvDate('')).toBe('');
    });

    it('passes through an unrecognized string verbatim rather than fabricating anything', () => {
      expect(formatCvDate('sometime in Q3')).toBe('sometime in Q3');
    });
  });

  describe('formatCvDateRange', () => {
    it('renders a current role as "... – Present", never a fabricated end date', () => {
      expect(formatCvDateRange('Jan 2024', null, true)).toBe('Jan 2024 – Present');
    });

    it('renders a non-current role with a real end date', () => {
      expect(formatCvDateRange('Sep 2022', 'Dec 2023', false)).toBe('Sep 2022 – Dec 2023');
    });

    it('renders the start date only when non-current with no end date - never invents one', () => {
      expect(formatCvDateRange('Jan 2024', null, false)).toBe('Jan 2024');
    });
  });

  describe('cvDateSortKey', () => {
    it('sorts newer Mon YYYY dates higher than older ones', () => {
      expect(cvDateSortKey('Jan 2024')).toBeGreaterThan(cvDateSortKey('Aug 2017'));
    });

    it('sorts bare years correctly relative to Mon YYYY dates', () => {
      expect(cvDateSortKey('2024')).toBeGreaterThan(cvDateSortKey('2019'));
    });

    it('never throws on an unparseable string, sorting it as 0', () => {
      expect(cvDateSortKey('not a date')).toBe(0);
      expect(cvDateSortKey(null)).toBe(0);
    });
  });
});
