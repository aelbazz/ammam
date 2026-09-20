import { isValidSectionKey, sectionLabel, SECTION_KEYS, SECTIONS } from './section-registry';

describe('section-registry', () => {
  it('keeps SECTION_KEYS in sync with SECTIONS', () => {
    expect(SECTION_KEYS).toEqual(SECTIONS.map((s) => s.key));
  });

  it('validates known and rejects unknown keys', () => {
    expect(isValidSectionKey('projects')).toBe(true);
    expect(isValidSectionKey('nonexistent')).toBe(false);
  });

  it('returns a human label for a known key and the key itself for an unknown one', () => {
    expect(sectionLabel('projects')).toBe('Projects');
    expect(sectionLabel('nonexistent')).toBe('nonexistent');
  });

  it('has no duplicate keys', () => {
    expect(new Set(SECTION_KEYS).size).toBe(SECTION_KEYS.length);
  });
});
