import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TenantAccessService } from '../tenant-access/tenant-access.service';
import { normalizeSlug } from '../common/utils/slug.util';
import {
  PublicAchievementDto,
  PublicContactDto,
  PublicCourseDto,
  PublicExperienceDto,
  PublicManagementRoleDto,
  PublicPersonDto,
  PublicProfileDto,
  PublicProjectDto,
  PublicSkillDataDto,
  PublicTimelineEventDto,
} from './dto/public-profile.dto';

/** Ascending by the authored display order. Applied to every collection. */
const byOrder = { sortOrder: 'asc' } as const;
/** Root collections additionally hide unpublished rows from the public payload. */
const publishedOnly = { isPublished: true } as const;

export interface ResolvedProfile {
  profile: PublicProfileDto;
  tenantId: string;
  personId: string;
  /** Set when `slug` was found via TenantSlugHistory rather than the tenant's current slug -
   *  the frontend can use this to update the address bar without a hard redirect. */
  redirectedFromSlug: string | null;
}

@Injectable()
export class PublicProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantAccess: TenantAccessService,
  ) {}

  /**
   * Resolves a tenant slug to its full public profile.
   *
   * Slugs are stored and compared lower-case, so lookup is case-insensitive without a
   * database-level `LOWER()` scan. If the slug does not match any live tenant, retired
   * slugs (TenantSlugHistory) are checked next, so a previously shared profile URL
   * degrades to "moved" rather than a plain 404 - see docs/SAAS-ARCHITECTURE.md.
   */
  async resolveBySlug(rawSlug: string): Promise<ResolvedProfile> {
    const slug = normalizeSlug(rawSlug);

    let tenantId = await this.prisma.tenant.findUnique({
      where: { slug },
      select: { id: true },
    });
    let redirectedFromSlug: string | null = null;

    if (!tenantId) {
      const history = await this.prisma.tenantSlugHistory.findUnique({
        where: { slug },
        select: { tenantId: true },
      });
      if (!history) {
        throw new NotFoundException(`No profile exists at "${rawSlug}"`);
      }
      tenantId = { id: history.tenantId };
      redirectedFromSlug = slug;
    }

    const { profile, personId } = await this.buildProfile(tenantId.id);
    return { profile, tenantId: tenantId.id, personId, redirectedFromSlug };
  }

  /**
   * Loads and assembles the entire public profile for one tenant.
   *
   * This is a SINGLE Prisma query with nested includes - Prisma issues a small, fixed batch
   * of SQL statements (one per relation level), never one per parent row. There is no N+1
   * here and no query count that grows with the number of experiences or projects.
   *
   * The payload is bounded by the size of one person's CV, so it is returned whole and
   * never paginated.
   */
  private async buildProfile(
    tenantId: string,
  ): Promise<{ profile: PublicProfileDto; personId: string }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        subscription: { select: { status: true } },
        theme: true,
        settings: true,
        person: {
          include: {
            contact: {
              include: { socialLinks: { orderBy: byOrder } },
            },
            experiences: {
              where: publishedOnly,
              orderBy: byOrder,
              include: {
                responsibilities: { orderBy: byOrder, select: { description: true } },
                achievements: { orderBy: byOrder, select: { description: true } },
                technologies: {
                  orderBy: byOrder,
                  select: { technology: { select: { name: true } } },
                },
              },
            },
            projects: {
              where: publishedOnly,
              orderBy: byOrder,
              include: {
                highlights: { orderBy: byOrder, select: { description: true } },
                technologies: {
                  orderBy: byOrder,
                  select: { technology: { select: { name: true } } },
                },
              },
            },
            achievements: { where: publishedOnly, orderBy: byOrder },
            courses: {
              where: publishedOnly,
              orderBy: byOrder,
              include: { skills: { orderBy: byOrder, select: { name: true } } },
            },
            timelineEvents: { where: publishedOnly, orderBy: byOrder },
            managementRoles: {
              where: publishedOnly,
              orderBy: byOrder,
              include: {
                keyResponsibilities: { orderBy: byOrder, select: { description: true } },
                achievements: { orderBy: byOrder, select: { description: true } },
              },
            },
            skillCategories: {
              where: publishedOnly,
              orderBy: byOrder,
              include: { skills: { orderBy: byOrder } },
            },
          },
        },
      },
    });

    if (!tenant || !tenant.person) {
      // A tenant that completed onboarding always has a Person (created in the same
      // transaction); one without is either mid-onboarding or a data problem either way,
      // not something to serve.
      throw new NotFoundException('Profile not found');
    }

    const access = this.tenantAccess.isPubliclyAccessible(
      tenant.status,
      tenant.subscription?.status ?? null,
    );
    if (!access.allowed) {
      // Deliberately the same 404 as an unknown slug: a suspended tenant's URL should not
      // announce "this tenant exists but is suspended" to an anonymous caller.
      throw new NotFoundException('Profile not found');
    }

    const person = tenant.person;

    // Explicit field-by-field mapping. Nothing is spread from the Prisma row, so database
    // ids, timestamps and isPublished flags cannot leak into the response by accident.
    const personDto: PublicPersonDto = {
      name: person.name,
      title: person.title,
      summary: person.summary,
      location: person.location,
      yearsOfExperience: person.yearsOfExperience,
      avatar: person.avatar,
      tagline: person.tagline,
      linkedin: person.linkedin,
      birthday: person.birthday,
    };

    const contact: PublicContactDto | null = person.contact
      ? {
          email: person.contact.email,
          phone: person.contact.phone,
          whatsapp: person.contact.whatsapp,
          linkedin: person.contact.linkedin,
          location: person.contact.location,
          birthday: person.contact.birthday,
          muchskills: person.contact.muchskills,
          socialLinks: person.contact.socialLinks.map((link) => ({
            platform: link.platform,
            url: link.url,
            icon: link.icon,
          })),
        }
      : null;

    const experiences: PublicExperienceDto[] = person.experiences.map((e) => ({
      id: e.legacyId,
      company: e.company,
      companyFullName: e.companyFullName,
      companyLogo: e.companyLogo,
      companyWebsite: e.companyWebsite,
      companyDescription: e.companyDescription,
      position: e.position,
      location: e.location,
      startDate: e.startDate,
      endDate: e.endDate,
      isCurrent: e.isCurrent,
      description: e.description,
      responsibilities: e.responsibilities.map((r) => r.description),
      technologies: e.technologies.map((t) => t.technology.name),
      achievements: e.achievements.map((a) => a.description),
    }));

    const projects: PublicProjectDto[] = person.projects.map((p) => ({
      id: p.legacyId,
      name: p.name,
      description: p.description,
      role: p.role,
      startDate: p.startDate,
      endDate: p.endDate,
      technologies: p.technologies.map((t) => t.technology.name),
      highlights: p.highlights.map((h) => h.description),
      imageUrl: p.imageUrl,
      githubUrl: p.githubUrl,
      liveUrl: p.liveUrl,
      isStrategicInitiative: p.isStrategicInitiative,
      isCurrent: p.isCurrent,
      type: p.type,
      company: p.company,
    }));

    const achievements: PublicAchievementDto[] = person.achievements.map((a) => ({
      id: a.legacyId,
      title: a.title,
      description: a.description,
      date: a.date,
      category: a.category,
      organization: a.organization,
      icon: a.icon,
      articleUrl: a.articleUrl,
    }));

    const courses: PublicCourseDto[] = person.courses.map((c) => ({
      id: c.legacyId,
      title: c.title,
      provider: c.provider,
      completionDate: c.completionDate,
      level: c.level,
      description: c.description,
      skills: c.skills.map((s) => s.name),
      duration: c.duration,
      instructor: c.instructor,
      courseUrl: c.courseUrl,
      certificateUrl: c.certificateUrl,
      startDate: c.startDate,
      grade: c.grade,
    }));

    const timelineEvents: PublicTimelineEventDto[] = person.timelineEvents.map((t) => ({
      id: t.legacyId,
      date: t.date,
      title: t.title,
      subtitle: t.subtitle,
      description: t.description,
      type: t.type,
      icon: t.icon,
    }));

    const managementRoles: PublicManagementRoleDto[] = person.managementRoles.map((m) => ({
      id: m.legacyId,
      level: m.level,
      title: m.title,
      organization: m.organization,
      startDate: m.startDate,
      endDate: m.endDate,
      isCurrent: m.isCurrent,
      description: m.description,
      teamSize: m.teamSize,
      keyResponsibilities: m.keyResponsibilities.map((r) => r.description),
      achievements: m.achievements.map((a) => a.description),
    }));

    // Shaped as { categories: [...] } to match the frontend SkillData interface exactly.
    // `category` is denormalised onto each skill because the frontend Skill model carries it.
    const skills: PublicSkillDataDto = {
      categories: person.skillCategories.map((c) => ({
        category: c.name,
        skills: c.skills.map((s) => ({
          name: s.name,
          level: s.level,
          category: c.name,
          since: s.since,
          icon: s.icon,
          yearsOfExperience: s.yearsOfExperience,
          endorsements: s.endorsements,
        })),
      })),
    };

    const profile: PublicProfileDto = {
      // Internal UUID deliberately omitted - the slug is the only public identifier.
      tenant: { slug: tenant.slug, name: tenant.name },
      person: personDto,
      contact,
      experiences,
      projects,
      achievements,
      courses,
      timelineEvents,
      managementRoles,
      skills,
      theme: {
        primaryColor: tenant.theme?.primaryColor ?? '#6366f1',
        secondaryColor: tenant.theme?.secondaryColor ?? '#64748b',
        accentColor: tenant.theme?.accentColor ?? '#06b6d4',
        backgroundColor: tenant.theme?.backgroundColor ?? '#ffffff',
        textColor: tenant.theme?.textColor ?? '#334155',
        headingColor: tenant.theme?.headingColor ?? '#0f172a',
        fontFamily: tenant.theme?.fontFamily ?? 'Inter, sans-serif',
        borderRadius: tenant.theme?.borderRadius ?? '0.5rem',
        layout: tenant.theme?.layout ?? 'classic',
        darkMode: tenant.theme?.darkMode ?? false,
        customCss: tenant.theme?.customCss ?? null,
      },
      settings: {
        websiteTitle: tenant.settings?.websiteTitle ?? tenant.name,
        description: tenant.settings?.description ?? null,
        faviconUrl: tenant.settings?.faviconUrl ?? null,
        logoUrl: tenant.settings?.logoUrl ?? null,
        visibleSections: tenant.settings?.visibleSections ?? [],
        sectionOrder: tenant.settings?.sectionOrder ?? [],
        seoTitle: tenant.settings?.seoTitle ?? null,
        seoDescription: tenant.settings?.seoDescription ?? null,
        ogImageUrl: tenant.settings?.ogImageUrl ?? null,
      },
    };

    return { profile, personId: person.id };
  }

  /**
   * Most recent updatedAt across every table that feeds the public payload. Used for
   * Last-Modified. Runs as one aggregate batch, not a full row scan.
   */
  async getLastModified(tenantId: string, personId: string): Promise<Date> {
    const where = { personId };
    const max = { _max: { updatedAt: true } } as const;

    const [
      tenant,
      theme,
      settings,
      contact,
      experiences,
      projects,
      achievements,
      courses,
      timeline,
      mgmt,
      skillCats,
    ] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { updatedAt: true } }),
      this.prisma.tenantTheme.findUnique({ where: { tenantId }, select: { updatedAt: true } }),
      this.prisma.websiteSettings.findUnique({ where: { tenantId }, select: { updatedAt: true } }),
      this.prisma.contact.aggregate({ where, ...max }),
      this.prisma.experience.aggregate({ where, ...max }),
      this.prisma.project.aggregate({ where, ...max }),
      this.prisma.achievement.aggregate({ where, ...max }),
      this.prisma.course.aggregate({ where, ...max }),
      this.prisma.timelineEvent.aggregate({ where, ...max }),
      this.prisma.managementRole.aggregate({ where, ...max }),
      this.prisma.skillCategory.aggregate({ where, ...max }),
    ]);

    const candidates = [
      tenant?.updatedAt,
      theme?.updatedAt,
      settings?.updatedAt,
      contact._max.updatedAt,
      experiences._max.updatedAt,
      projects._max.updatedAt,
      achievements._max.updatedAt,
      courses._max.updatedAt,
      timeline._max.updatedAt,
      mgmt._max.updatedAt,
      skillCats._max.updatedAt,
    ].filter((d): d is Date => d instanceof Date);

    return candidates.reduce((latest, d) => (d > latest ? d : latest), new Date(0));
  }

  /** Strong ETag over the serialised payload. */
  computeETag(payload: PublicProfileDto): string {
    const hash = createHash('sha256').update(JSON.stringify(payload)).digest('base64url');
    return `"${hash.slice(0, 32)}"`;
  }
}
