import { Injectable, NotFoundException } from '@nestjs/common';
import { CvVersion, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { cvSectionHeading } from './cv-section-registry';
import { cvDateSortKey, formatCvDate, formatCvDateRange } from './cv-date.util';
import {
  CvAchievementEntry,
  CvCertificationEntry,
  CvDocument,
  CvEducationEntry,
  CvExperienceEntry,
  CvProjectEntry,
  CvSkillGroup,
} from './cv-document.model';

const byOrder = { sortOrder: 'asc' } as const;

const GITHUB_PLATFORMS = new Set(['github']);
const PORTFOLIO_PLATFORMS = new Set(['portfolio', 'website', 'personal website', 'personal site']);

interface SectionConfigEntry {
  key: string;
  enabled: boolean;
}

/** `CvVersion`'s Json columns arrive as `Prisma.JsonValue` (unknown shape as far as the type
 *  system is concerned) - these two helpers parse them defensively. A malformed or
 *  unexpected shape degrades to "no override"/"nothing excluded" rather than throwing, since
 *  this data is never attacker-controlled (only this tenant's own PATCH requests write it,
 *  already DTO-validated) but could in principle predate a shape change. */
function toStringArray(value: Prisma.JsonValue | null | undefined): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function toSectionConfig(value: Prisma.JsonValue): SectionConfigEntry[] {
  if (!Array.isArray(value)) return [];
  const entries: SectionConfigEntry[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const key = typeof record['key'] === 'string' ? record['key'] : '';
    if (!key) continue;
    entries.push({ key, enabled: record['enabled'] !== false });
  }
  return entries;
}

/**
 * Builds the one normalized `CvDocument` a CvVersion's configuration resolves to, reading
 * live Prisma data - the ONLY place Experience/Project/.../Prisma rows become CV content.
 * The preview endpoint, the PDF generator, and the DOCX generator all consume this same
 * output, never Prisma entities directly - see cv-document.model.ts.
 */
@Injectable()
export class CvBuilderService {
  constructor(private readonly prisma: PrismaService) {}

  async build(personId: string, version: CvVersion): Promise<CvDocument> {
    const person = await this.prisma.person.findUnique({
      where: { id: personId },
      include: { contact: { include: { socialLinks: { orderBy: byOrder } } } },
    });
    if (!person) throw new NotFoundException('Profile not found');

    const excludedExperienceIds = new Set(toStringArray(version.excludedExperienceIds));
    const excludedProjectIds = new Set(toStringArray(version.excludedProjectIds));
    const sectionConfig = toSectionConfig(version.sectionConfig);

    const [
      experienceRows,
      managementRows,
      skillCategories,
      projectRows,
      educationRows,
      courseRows,
      achievementRows,
    ] = await Promise.all([
      this.prisma.experience.findMany({
        where: { personId, id: { notIn: [...excludedExperienceIds] } },
        orderBy: byOrder,
        include: {
          responsibilities: { orderBy: byOrder },
          achievements: { orderBy: byOrder },
          technologies: { orderBy: byOrder, include: { technology: true } },
        },
      }),
      version.includeManagement
        ? this.prisma.managementRole.findMany({
            where: { personId },
            orderBy: byOrder,
            include: {
              keyResponsibilities: { orderBy: byOrder },
              achievements: { orderBy: byOrder },
            },
          })
        : Promise.resolve([]),
      this.prisma.skillCategory.findMany({
        where: { personId },
        orderBy: byOrder,
        include: { skills: { orderBy: byOrder } },
      }),
      this.prisma.project.findMany({
        where: { personId, id: { notIn: [...excludedProjectIds] } },
        orderBy: byOrder,
        include: {
          highlights: { orderBy: byOrder },
          technologies: { orderBy: byOrder, include: { technology: true } },
        },
      }),
      this.prisma.timelineEvent.findMany({
        where: { personId, type: 'education' },
        orderBy: byOrder,
      }),
      this.prisma.course.findMany({
        where: { personId },
        orderBy: byOrder,
        include: { skills: { orderBy: byOrder } },
      }),
      this.prisma.achievement.findMany({ where: { personId }, orderBy: byOrder }),
    ]);

    // -- experience: Experience + (optionally) ManagementRole, merged and date-sorted -------

    const experienceEntries: Array<CvExperienceEntry & { __sortId: string; __sortKey: number }> = [
      ...experienceRows.map((e) => ({
        __sortId: e.id,
        __sortKey: cvDateSortKey(e.startDate),
        organization: e.company,
        role: e.position,
        location: e.location,
        dateRange: formatCvDateRange(e.startDate, e.endDate, e.isCurrent),
        bullets: [
          ...e.responsibilities.map((r) => r.description),
          ...e.achievements.map((a) => a.description),
        ],
        technologies: e.technologies.map((t) => t.technology.name),
      })),
      ...managementRows.map((m) => ({
        __sortId: m.id,
        __sortKey: cvDateSortKey(m.startDate),
        organization: m.organization,
        role: m.title,
        location: null,
        dateRange: formatCvDateRange(m.startDate, m.endDate, m.isCurrent),
        bullets: [
          ...m.keyResponsibilities.map((r) => r.description),
          ...m.achievements.map((a) => a.description),
        ],
        technologies: [] as string[],
      })),
    ];
    const orderedExperience = this.applyOrder(
      experienceEntries,
      toStringArray(version.experienceOrder),
    );
    const experience: CvExperienceEntry[] = orderedExperience.map(
      ({ __sortId, __sortKey, ...entry }) => entry,
    );

    // -- skills: one SkillCategory -> one CvSkillGroup, comma-joined skill names ------------

    const skills: CvSkillGroup[] = skillCategories
      .filter((c) => c.skills.length > 0)
      .map((c) => ({ category: c.name, skills: c.skills.map((s) => s.name) }));

    // -- projects -----------------------------------------------------------------------

    const projectEntries: Array<CvProjectEntry & { __sortId: string; __sortKey: number }> =
      projectRows.map((p) => ({
        __sortId: p.id,
        __sortKey: cvDateSortKey(p.startDate),
        name: p.name,
        role: p.role,
        dateRange: formatCvDateRange(p.startDate, p.endDate, p.isCurrent),
        description: p.description,
        highlights: p.highlights.map((h) => h.description),
        technologies: p.technologies.map((t) => t.technology.name),
        githubUrl: p.githubUrl,
        liveUrl: p.liveUrl,
      }));
    const orderedProjects = this.applyOrder(projectEntries, toStringArray(version.projectOrder));
    const projects: CvProjectEntry[] = orderedProjects.map(
      ({ __sortId, __sortKey, ...entry }) => entry,
    );

    // -- education: TimelineEvent, type === 'education' only --------------------------------

    const education: CvEducationEntry[] = educationRows.map((e) => ({
      title: e.title,
      subtitle: e.subtitle,
      date: formatCvDate(e.date),
      description: e.description,
    }));

    // -- certifications: Course ----------------------------------------------------------

    const certifications: CvCertificationEntry[] = courseRows.map((c) => ({
      title: c.title,
      provider: c.provider,
      date: formatCvDate(c.completionDate),
      skills: c.skills.map((s) => s.name),
    }));

    // -- achievements ---------------------------------------------------------------------

    const achievements: CvAchievementEntry[] = achievementRows.map((a) => ({
      title: a.title,
      organization: a.organization,
      date: formatCvDate(a.date),
      description: a.description,
    }));

    // -- header / contacts ------------------------------------------------------------------

    const contact = person.contact;
    const contacts: CvDocument['header']['contacts'] = [];
    if (version.includeEmail && contact?.email) {
      contacts.push({ label: 'Email', value: contact.email, href: `mailto:${contact.email}` });
    }
    if (version.includePhone && contact?.phone) {
      contacts.push({ label: 'Phone', value: contact.phone });
    }
    if (version.includeLinkedin && contact?.linkedin) {
      contacts.push({
        label: 'LinkedIn',
        value: this.shortenUrl(contact.linkedin),
        href: contact.linkedin,
      });
    }
    if (version.includeGithub) {
      const link = contact?.socialLinks.find((l) => GITHUB_PLATFORMS.has(l.platform.toLowerCase()));
      if (link)
        contacts.push({ label: 'GitHub', value: this.shortenUrl(link.url), href: link.url });
    }
    if (version.includePortfolio) {
      const link = contact?.socialLinks.find((l) =>
        PORTFOLIO_PLATFORMS.has(l.platform.toLowerCase()),
      );
      if (link)
        contacts.push({ label: 'Portfolio', value: this.shortenUrl(link.url), href: link.url });
    }

    // -- section order: only sections with real content, in the version's configured order --

    const sectionContent: Record<string, unknown[]> = {
      experience,
      skills,
      projects,
      education,
      courses: certifications,
      achievements,
    };
    const sectionOrder = sectionConfig
      .filter((s) => s.enabled && (sectionContent[s.key]?.length ?? 0) > 0)
      .map((s) => s.key);
    // Defensive fallback: a version whose sectionConfig predates a registry key addition (or
    // was never set) still shows every non-empty section, in the registry's own order.
    if (sectionOrder.length === 0 && sectionConfig.length === 0) {
      for (const key of Object.keys(sectionContent)) {
        if (sectionContent[key].length > 0) sectionOrder.push(key);
      }
    }

    const summary = (version.cvSummary ?? person.summary ?? '').trim() || null;

    return {
      meta: {
        title: `${person.name} - CV`,
        author: person.name,
        subject: 'Curriculum Vitae',
        creator: 'Portfolio Platform CV Generator',
      },
      header: {
        fullName: person.name,
        headline: version.cvTitle ?? person.title,
        location: contact?.location ?? person.location ?? null,
        contacts,
      },
      summary,
      sectionOrder,
      experience,
      skills,
      projects,
      education,
      certifications,
      achievements,
    };
  }

  /** cvSectionHeading is exposed for generators that need the literal ATS heading text for a
   *  section key resolved by build() above. */
  headingFor(key: string): string {
    return cvSectionHeading(key);
  }

  private shortenUrl(url: string): string {
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }

  /** Ids present in `order` take that relative position first; everything else keeps its
   *  existing (already date-sorted, newest-first) relative order, appended after. Null/empty
   *  `order` (Phase 1's only value, since no UI writes it yet) is a no-op passthrough. */
  private applyOrder<T extends { __sortId: string; __sortKey: number }>(
    entries: T[],
    order: string[],
  ): T[] {
    const dateSorted = [...entries].sort((a, b) => b.__sortKey - a.__sortKey);
    if (order.length === 0) return dateSorted;

    const byId = new Map(dateSorted.map((e) => [e.__sortId, e]));
    const ordered: T[] = [];
    for (const id of order) {
      const entry = byId.get(id);
      if (entry) {
        ordered.push(entry);
        byId.delete(id);
      }
    }
    return [...ordered, ...byId.values()];
  }
}
