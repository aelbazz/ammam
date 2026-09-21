import {
  CV_SECTIONS,
  CV_SECTION_KEYS,
  cvSectionHeading,
  isValidCvSectionKey,
} from './cv-section-registry';

describe('cv-section-registry', () => {
  it('keeps CV_SECTION_KEYS in sync with CV_SECTIONS', () => {
    expect(CV_SECTION_KEYS).toEqual(CV_SECTIONS.map((s) => s.key));
  });

  it('validates known and rejects unknown keys', () => {
    expect(isValidCvSectionKey('experience')).toBe(true);
    expect(isValidCvSectionKey('nonexistent')).toBe(false);
  });

  it('returns the literal ATS heading for a known key and the key itself for an unknown one', () => {
    expect(cvSectionHeading('experience')).toBe('Professional Experience');
    expect(cvSectionHeading('courses')).toBe('Certifications');
    expect(cvSectionHeading('nonexistent')).toBe('nonexistent');
  });

  it('has no duplicate keys', () => {
    expect(new Set(CV_SECTION_KEYS).size).toBe(CV_SECTION_KEYS.length);
  });
});
