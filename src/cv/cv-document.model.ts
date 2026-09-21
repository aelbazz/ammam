/**
 * The one normalized CV representation. `CvBuilderService` is the only place a Prisma entity
 * ever becomes one of these; from here on, the preview endpoint, the PDF generator, and the
 * DOCX generator all consume exactly this shape - never Prisma types directly - so the three
 * outputs can never drift out of sync with each other. See docs/SAAS-ARCHITECTURE.md.
 */

export interface CvDocumentMeta {
  /** "<FullName> - CV" */
  title: string;
  /** FullName only - never a tenant/client internal id. */
  author: string;
  subject: string;
  creator: string;
}

export interface CvContactLine {
  label: string;
  value: string;
  href?: string;
}

export interface CvHeader {
  fullName: string;
  /** Person.title, or CvVersion.cvTitle when set. */
  headline: string;
  location: string | null;
  /** Already filtered by includePhone/Email/Linkedin/Github/Portfolio. */
  contacts: CvContactLine[];
}

export interface CvExperienceEntry {
  /** Experience.company, or ManagementRole.organization for a folded-in leadership row. */
  organization: string;
  /** Experience.position, or ManagementRole.title. */
  role: string;
  location: string | null;
  dateRange: string;
  bullets: string[];
  technologies: string[];
}

export interface CvSkillGroup {
  /** e.g. "Frontend Technologies" - one SkillCategory.name. */
  category: string;
  skills: string[];
}

export interface CvProjectEntry {
  name: string;
  role: string;
  dateRange: string;
  description: string;
  highlights: string[];
  technologies: string[];
  githubUrl: string | null;
  liveUrl: string | null;
}

export interface CvEducationEntry {
  title: string;
  subtitle: string | null;
  date: string;
  description: string;
}

export interface CvCertificationEntry {
  title: string;
  provider: string;
  date: string;
  skills: string[];
}

export interface CvAchievementEntry {
  title: string;
  organization: string | null;
  date: string;
  description: string;
}

export interface CvDocument {
  meta: CvDocumentMeta;
  header: CvHeader;
  /** cvSummary ?? Person.summary, trimmed; null when empty - never an empty "Summary" heading. */
  summary: string | null;
  /** Resolved order of the NON-EMPTY, enabled sections only - drives rendering directly in
   *  every consumer (preview, PDF, DOCX). A section key never appears here with an empty
   *  array behind it. */
  sectionOrder: string[];
  experience: CvExperienceEntry[];
  skills: CvSkillGroup[];
  projects: CvProjectEntry[];
  education: CvEducationEntry[];
  certifications: CvCertificationEntry[];
  achievements: CvAchievementEntry[];
}
