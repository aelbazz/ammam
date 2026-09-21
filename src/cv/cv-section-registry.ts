/**
 * The CV's own section catalog - deliberately NOT the same set as the public site's
 * section-registry.ts (src/section/section-registry.ts). A CV has an "Education" section
 * (built from TimelineEvent rows where type === 'education', which has no public-site
 * section of its own) and folds ManagementRole into "Professional Experience" (the approved
 * ATS heading list - see cvSectionHeading below - has no separate "Leadership" entry).
 * Registry pattern, not a DB enum - see design-registry.ts for the same reasoning.
 */
export interface CvSectionDefinition {
  readonly key: string;
  /** The literal ATS-conventional heading text - never a creative label. */
  readonly heading: string;
}

export const CV_SECTIONS: readonly CvSectionDefinition[] = [
  { key: 'experience', heading: 'Professional Experience' },
  { key: 'skills', heading: 'Technical Skills' },
  { key: 'projects', heading: 'Projects' },
  { key: 'education', heading: 'Education' },
  { key: 'courses', heading: 'Certifications' },
  { key: 'achievements', heading: 'Achievements' },
];

export const CV_SECTION_KEYS: readonly string[] = CV_SECTIONS.map((s) => s.key);

export function isValidCvSectionKey(key: string): boolean {
  return CV_SECTIONS.some((s) => s.key === key);
}

export function cvSectionHeading(key: string): string {
  return CV_SECTIONS.find((s) => s.key === key)?.heading ?? key;
}
