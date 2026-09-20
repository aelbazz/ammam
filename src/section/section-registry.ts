/**
 * The platform's public-profile section catalog. Adding a future section (testimonials,
 * services, publications, ...) is a code change here plus a new backfill migration for
 * existing tenants - never a schema change to ClientSection itself. This is the "registry,
 * not a hardcoded enum" pattern already used for design systems - see design-registry.ts.
 *
 * These are the site's real, separately-rendered sections. "Hero"/"about"/"social" from the
 * original spec were deliberately not used as separate keys: the tenant home page already
 * combines hero+about into one profile section, and social links render inside Contact
 * rather than as their own route - see docs/SAAS-ARCHITECTURE.md.
 */
export interface SectionDefinition {
  readonly key: string;
  readonly label: string;
}

export const SECTIONS: readonly SectionDefinition[] = [
  { key: 'profile', label: 'Profile / Hero' },
  { key: 'experience', label: 'Experience' },
  { key: 'projects', label: 'Projects' },
  { key: 'skills', label: 'Skills & Technologies' },
  { key: 'achievements', label: 'Achievements' },
  { key: 'courses', label: 'Courses' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'management', label: 'Management Roles' },
  { key: 'contact', label: 'Contact' },
];

export const SECTION_KEYS: readonly string[] = SECTIONS.map((s) => s.key);

export function isValidSectionKey(key: string): boolean {
  return SECTIONS.some((s) => s.key === key);
}

export function sectionLabel(key: string): string {
  return SECTIONS.find((s) => s.key === key)?.label ?? key;
}
