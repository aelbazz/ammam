import { RESERVED_SLUGS, isValidSlugFormat, normalizeSlug, slugCandidates } from './slug.util';

describe('normalizeSlug', () => {
  it.each([
    ['John Doe', 'john-doe'],
    ['ACME Consulting', 'acme-consulting'],
    ['My AI Profile', 'my-ai-profile'],
    ['  spaced out  ', 'spaced-out'],
    ['Multiple---Hyphens', 'multiple-hyphens'],
    ['Already-Lower-Case', 'already-lower-case'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeSlug(input)).toBe(expected);
  });

  it('produces no leading or trailing hyphen', () => {
    expect(normalizeSlug('---weird---')).not.toMatch(/^-|-$/);
  });
});

describe('isValidSlugFormat', () => {
  it('accepts well-formed slugs', () => {
    expect(isValidSlugFormat('john-doe')).toBe(true);
    expect(isValidSlugFormat('a')).toBe(true);
    expect(isValidSlugFormat('acme-consulting-2')).toBe(true);
  });

  it('rejects every reserved slug', () => {
    for (const reserved of RESERVED_SLUGS) {
      expect(isValidSlugFormat(reserved)).toBe(false);
    }
  });

  it('rejects the Portfolio marketing site routes specifically', () => {
    expect(isValidSlugFormat('about')).toBe(false);
    expect(isValidSlugFormat('services')).toBe(false);
    expect(isValidSlugFormat('contact')).toBe(false);
  });

  it('rejects uppercase, spaces, and leading/trailing hyphens', () => {
    expect(isValidSlugFormat('John-Doe')).toBe(false);
    expect(isValidSlugFormat('john doe')).toBe(false);
    expect(isValidSlugFormat('-john')).toBe(false);
    expect(isValidSlugFormat('john-')).toBe(false);
  });
});

describe('slugCandidates', () => {
  it('yields the normalized base first, then numbered fallbacks', () => {
    const gen = slugCandidates('Jane Doe');
    expect(gen.next().value).toBe('jane-doe');
    expect(gen.next().value).toBe('jane-doe-2');
    expect(gen.next().value).toBe('jane-doe-3');
  });

  it('falls back to a generic base when the name normalizes to nothing', () => {
    const gen = slugCandidates('!!!');
    expect(gen.next().value).toBe('tenant');
  });
});
