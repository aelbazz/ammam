/**
 * Which CV visual templates exist. Only ATS_CLASSIC is implemented in Phase 1 - the registry
 * exists so ATS_MODERN/ATS_EXECUTIVE/ATS_TECH can be added later as pure additions (a new
 * entry here plus a new generator branch), never a schema change. Registry pattern, not a DB
 * enum - see design-registry.ts.
 *
 * Deliberately unrelated to the public site's design-registry.ts: a CV template controls
 * document layout (PDF/DOCX structure), never the tenant's designSystem/layout/theme.
 */
export interface CvTemplateDefinition {
  readonly id: string;
  readonly label: string;
  readonly description: string;
}

export const CV_TEMPLATES: readonly CvTemplateDefinition[] = [
  {
    id: 'ATS_CLASSIC',
    label: 'ATS Classic',
    description:
      'Single-column, conservative layout optimized for reliable parsing by Applicant Tracking Systems.',
  },
];

export function isValidCvTemplateId(id: string): boolean {
  return CV_TEMPLATES.some((t) => t.id === id);
}
