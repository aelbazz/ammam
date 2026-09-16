import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
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

const DEFAULT_PERSON_SLUG = 'default';

/** Ascending by the authored display order. Applied to every collection. */
const byOrder = { sortOrder: 'asc' } as const;
/** Root collections additionally hide unpublished rows from the public payload. */
const publishedOnly = { isPublished: true } as const;

@Injectable()
export class PublicProfileService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Loads the entire public profile.
   *
   * This is a SINGLE Prisma query with nested includes - Prisma issues a small, fixed batch
   * of SQL statements (one per relation level), never one per parent row. There is no N+1
   * here and no query count that grows with the number of experiences or projects.
   *
   * The payload is ~100 KB and bounded by the size of one person's CV, so it is returned
   * whole and never paginated, exactly as the spec requires.
   */
  async getPublicProfile(slug: string = DEFAULT_PERSON_SLUG): Promise<PublicProfileDto> {
    const person = await this.prisma.person.findUnique({
      where: { slug },
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
    });

    if (!person) {
      throw new NotFoundException('Profile not found');
    }

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

    return {
      person: personDto,
      contact,
      experiences,
      projects,
      achievements,
      courses,
      timelineEvents,
      managementRoles,
      skills,
    };
  }

  /**
   * Most recent updatedAt across every table that feeds the public payload. Used for
   * Last-Modified. Runs as one aggregate batch, not a full row scan.
   */
  async getLastModified(slug: string = DEFAULT_PERSON_SLUG): Promise<Date> {
    const person = await this.prisma.person.findUnique({
      where: { slug },
      select: { id: true, updatedAt: true },
    });

    if (!person) {
      throw new NotFoundException('Profile not found');
    }

    const where = { personId: person.id };
    const max = { _max: { updatedAt: true } } as const;

    const [contact, experiences, projects, achievements, courses, timeline, mgmt, skillCats] =
      await Promise.all([
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
      person.updatedAt,
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
