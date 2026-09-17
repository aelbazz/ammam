/**
 * Import the existing Angular static profile data into PostgreSQL.
 *
 * This is a migration, not a fixture generator: every value comes from the JSON snapshot in
 * prisma/data/ (refreshed by scripts/sync-frontend-data.sh). No professional information is
 * invented anywhere in this file.
 *
 * Idempotent - upserts on the stable keys (person.slug, legacyId, technology.slug), so
 * re-running updates in place rather than duplicating.
 *
 * Ordering: every collection's array index becomes sortOrder, so the first API response
 * reproduces the current UI order exactly. See docs/MIGRATION-MAPPING.md §5.1.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  AchievementCategory,
  ManagementLevel,
  Prisma,
  PrismaClient,
  TimelineEventType,
} from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const DATA_DIR = join(__dirname, 'data');
const PERSON_SLUG = 'default';

// ---------------------------------------------------------------------------
// Source shapes - mirror the Angular interfaces exactly (src/app/core/models)
// ---------------------------------------------------------------------------

interface SrcProfile {
  name: string;
  title: string;
  summary: string;
  location: string;
  yearsOfExperience: number;
  avatar: string;
  tagline: string;
  linkedin?: string;
  birthday?: string;
}

interface SrcSocialLink {
  platform: string;
  url: string;
  icon?: string;
}

interface SrcContact {
  email: string;
  phone: string;
  whatsapp: string;
  linkedin: string;
  location?: string;
  birthday?: string;
  muchskills?: string;
  socialLinks: SrcSocialLink[];
}

interface SrcExperience {
  id: string;
  company: string;
  companyFullName?: string;
  companyLogo?: string;
  companyWebsite?: string;
  companyDescription?: string;
  position: string;
  location: string;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
  description: string;
  responsibilities: string[];
  technologies: string[];
  achievements: string[];
}

interface SrcProject {
  id: string;
  name: string;
  description: string;
  role: string;
  startDate: string;
  endDate: string | null;
  technologies: string[];
  highlights: string[];
  imageUrl?: string;
  githubUrl?: string;
  liveUrl?: string;
  isStrategicInitiative?: boolean;
  // Present in the data but absent from the frontend interface - see MIGRATION-MAPPING §5.7
  isCurrent?: boolean;
  type?: string;
  company?: string;
}

interface SrcAchievement {
  id: string;
  title: string;
  description: string;
  date: string;
  category: string;
  organization?: string;
  icon?: string;
  articleUrl?: string;
}

interface SrcCourse {
  id: string;
  title: string;
  provider: string;
  completionDate: string;
  certificateUrl?: string;
  courseUrl?: string;
  level?: string;
  instructor?: string;
  skills: string[];
  duration?: string;
  description?: string;
  // Data-only fields
  startDate?: string;
  grade?: string;
}

interface SrcTimelineEvent {
  id: string;
  date: string;
  title: string;
  subtitle: string;
  description: string;
  type: string;
  icon?: string;
}

interface SrcManagementRole {
  id: string;
  level: string;
  title: string;
  organization: string;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
  teamSize?: number;
  description: string;
  keyResponsibilities: string[];
  achievements: string[];
}

interface SrcSkill {
  name: string;
  level: number;
  category: string;
  since?: number;
  icon?: string;
  yearsOfExperience?: number;
  endorsements?: number;
}

interface SrcSkillCategory {
  category: string;
  skills: SrcSkill[];
}

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(join(DATA_DIR, file), 'utf-8')) as T;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalised matching key for technologies. Collapses case and punctuation so "Node.js",
 * "NodeJS" and "node js" resolve to one row instead of three.
 */
export function technologySlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Maps a source enum string onto the Prisma enum, failing loudly on unknown values. */
function toEnum<T extends Record<string, string>>(
  value: string,
  enumObject: T,
  field: string,
  recordId: string,
): T[keyof T] {
  const match = Object.values(enumObject).find((v) => v === value);
  if (!match) {
    throw new Error(
      `Unmappable ${field} value "${value}" on record ${recordId}. ` +
        `Known values: ${Object.values(enumObject).join(', ')}. ` +
        `Add it to the Prisma enum or correct the source data.`,
    );
  }
  return match as T[keyof T];
}

// ---------------------------------------------------------------------------
// Seed steps
// ---------------------------------------------------------------------------

async function seedPerson(): Promise<string> {
  const src = readJson<SrcProfile>('profile.json');

  const data = {
    name: src.name,
    title: src.title,
    summary: src.summary,
    location: src.location,
    yearsOfExperience: src.yearsOfExperience,
    avatar: src.avatar,
    tagline: src.tagline,
    linkedin: src.linkedin ?? null,
    birthday: src.birthday ?? null,
  };

  const person = await prisma.person.upsert({
    where: { slug: PERSON_SLUG },
    create: { slug: PERSON_SLUG, ...data },
    update: data,
  });

  console.log(`  person            1  (${person.name})`);
  return person.id;
}

async function seedContact(personId: string): Promise<void> {
  const src = readJson<SrcContact>('contact.json');

  const data = {
    email: src.email,
    phone: src.phone,
    whatsapp: src.whatsapp,
    linkedin: src.linkedin,
    location: src.location ?? null,
    birthday: src.birthday ?? null,
    muchskills: src.muchskills ?? null,
  };

  const contact = await prisma.contact.upsert({
    where: { personId },
    create: { personId, ...data },
    update: data,
  });

  // Children are replaced wholesale: the source array is the authority on both content
  // and order, and there is no stable natural key to match a social link on.
  await prisma.contactSocialLink.deleteMany({ where: { contactId: contact.id } });
  await prisma.contactSocialLink.createMany({
    data: src.socialLinks.map((link, index) => ({
      contactId: contact.id,
      platform: link.platform,
      url: link.url,
      icon: link.icon ?? null,
      sortOrder: index,
    })),
  });

  console.log(`  contact           1  (+${src.socialLinks.length} social links)`);
}

/**
 * Builds the technology table from the names referenced inline by experiences and projects.
 * There is no technology.json - the table is derived. Upserting on the normalised slug is
 * what guarantees a technology used by both an experience and a project gets ONE row.
 */
async function seedTechnologies(
  personId: string,
  experiences: SrcExperience[],
  projects: SrcProject[],
): Promise<Map<string, string>> {
  const bySlug = new Map<string, string>();

  for (const name of [
    ...experiences.flatMap((e) => e.technologies),
    ...projects.flatMap((p) => p.technologies),
  ]) {
    const trimmed = name.trim();
    const slug = technologySlug(trimmed);
    if (slug && !bySlug.has(slug)) {
      bySlug.set(slug, trimmed); // first occurrence wins the display casing
    }
  }

  const idBySlug = new Map<string, string>();
  for (const [slug, name] of bySlug) {
    const tech = await prisma.technology.upsert({
      where: { personId_slug: { personId, slug } },
      create: { personId, slug, name },
      update: { name },
    });
    idBySlug.set(slug, tech.id);
  }

  const refCount =
    experiences.reduce((n, e) => n + e.technologies.length, 0) +
    projects.reduce((n, p) => n + p.technologies.length, 0);
  console.log(
    `  technology       ${String(idBySlug.size).padStart(2)}  (deduplicated from ${refCount} references)`,
  );

  return idBySlug;
}

async function seedExperiences(
  personId: string,
  experiences: SrcExperience[],
  techIds: Map<string, string>,
): Promise<void> {
  let responsibilities = 0;
  let achievements = 0;
  let techLinks = 0;

  for (const [index, src] of experiences.entries()) {
    const data = {
      personId,
      company: src.company,
      companyFullName: src.companyFullName ?? null,
      companyLogo: src.companyLogo ?? null,
      companyWebsite: src.companyWebsite ?? null,
      companyDescription: src.companyDescription ?? null,
      position: src.position,
      location: src.location,
      startDate: src.startDate,
      endDate: src.endDate ?? null,
      isCurrent: src.isCurrent,
      description: src.description,
      sortOrder: index,
    };

    const experience = await prisma.experience.upsert({
      where: { personId_legacyId: { personId, legacyId: src.id } },
      create: { legacyId: src.id, ...data },
      update: data,
    });

    await prisma.experienceResponsibility.deleteMany({ where: { experienceId: experience.id } });
    await prisma.experienceAchievement.deleteMany({ where: { experienceId: experience.id } });
    await prisma.experienceTechnology.deleteMany({ where: { experienceId: experience.id } });

    await prisma.experienceResponsibility.createMany({
      data: src.responsibilities.map((description, i) => ({
        experienceId: experience.id,
        description,
        sortOrder: i,
      })),
    });
    responsibilities += src.responsibilities.length;

    await prisma.experienceAchievement.createMany({
      data: src.achievements.map((description, i) => ({
        experienceId: experience.id,
        description,
        sortOrder: i,
      })),
    });
    achievements += src.achievements.length;

    // Deduplicate within a single experience too - the composite PK would reject repeats.
    const seen = new Set<string>();
    const links: Prisma.ExperienceTechnologyCreateManyInput[] = [];
    for (const [i, name] of src.technologies.entries()) {
      const slug = technologySlug(name);
      const technologyId = techIds.get(slug);
      if (!technologyId || seen.has(slug)) continue;
      seen.add(slug);
      links.push({ experienceId: experience.id, technologyId, sortOrder: i });
    }
    await prisma.experienceTechnology.createMany({ data: links });
    techLinks += links.length;
  }

  console.log(
    `  experience        ${experiences.length}  (+${responsibilities} responsibilities, ` +
      `+${achievements} achievements, +${techLinks} technology links)`,
  );
}

async function seedProjects(
  personId: string,
  projects: SrcProject[],
  techIds: Map<string, string>,
): Promise<void> {
  let highlights = 0;
  let techLinks = 0;

  for (const [index, src] of projects.entries()) {
    const data = {
      personId,
      name: src.name,
      description: src.description,
      role: src.role,
      startDate: src.startDate,
      endDate: src.endDate ?? null,
      type: src.type ?? null,
      company: src.company ?? null,
      isCurrent: src.isCurrent ?? false,
      isStrategicInitiative: src.isStrategicInitiative ?? false,
      imageUrl: src.imageUrl ?? null,
      githubUrl: src.githubUrl ?? null,
      liveUrl: src.liveUrl ?? null,
      sortOrder: index,
    };

    const project = await prisma.project.upsert({
      where: { personId_legacyId: { personId, legacyId: src.id } },
      create: { legacyId: src.id, ...data },
      update: data,
    });

    await prisma.projectHighlight.deleteMany({ where: { projectId: project.id } });
    await prisma.projectTechnology.deleteMany({ where: { projectId: project.id } });

    await prisma.projectHighlight.createMany({
      data: src.highlights.map((description, i) => ({
        projectId: project.id,
        description,
        sortOrder: i,
      })),
    });
    highlights += src.highlights.length;

    const seen = new Set<string>();
    const links: Prisma.ProjectTechnologyCreateManyInput[] = [];
    for (const [i, name] of src.technologies.entries()) {
      const slug = technologySlug(name);
      const technologyId = techIds.get(slug);
      if (!technologyId || seen.has(slug)) continue;
      seen.add(slug);
      links.push({ projectId: project.id, technologyId, sortOrder: i });
    }
    await prisma.projectTechnology.createMany({ data: links });
    techLinks += links.length;
  }

  console.log(
    `  project          ${projects.length}  (+${highlights} highlights, +${techLinks} technology links)`,
  );
}

async function seedAchievements(personId: string): Promise<void> {
  const items = readJson<{ achievements: SrcAchievement[] }>('achievements.json').achievements;

  for (const [index, src] of items.entries()) {
    const data = {
      personId,
      title: src.title,
      description: src.description,
      date: src.date,
      category: toEnum(src.category, AchievementCategory, 'achievement.category', src.id),
      organization: src.organization ?? null,
      icon: src.icon ?? null,
      articleUrl: src.articleUrl ?? null,
      sortOrder: index,
    };
    await prisma.achievement.upsert({
      where: { personId_legacyId: { personId, legacyId: src.id } },
      create: { legacyId: src.id, ...data },
      update: data,
    });
  }

  console.log(`  achievement      ${items.length}`);
}

async function seedCourses(personId: string): Promise<void> {
  const items = readJson<{ courses: SrcCourse[] }>('courses.json').courses;
  let skills = 0;

  for (const [index, src] of items.entries()) {
    const data = {
      personId,
      title: src.title,
      provider: src.provider,
      completionDate: src.completionDate,
      level: src.level ?? null,
      description: src.description ?? null,
      duration: src.duration ?? null,
      instructor: src.instructor ?? null,
      courseUrl: src.courseUrl ?? null,
      certificateUrl: src.certificateUrl ?? null,
      startDate: src.startDate ?? null,
      grade: src.grade ?? null,
      sortOrder: index,
    };

    const course = await prisma.course.upsert({
      where: { personId_legacyId: { personId, legacyId: src.id } },
      create: { legacyId: src.id, ...data },
      update: data,
    });

    await prisma.courseSkill.deleteMany({ where: { courseId: course.id } });
    await prisma.courseSkill.createMany({
      data: src.skills.map((name, i) => ({ courseId: course.id, name, sortOrder: i })),
    });
    skills += src.skills.length;
  }

  console.log(`  course           ${items.length}  (+${skills} course skills)`);
}

async function seedTimeline(personId: string): Promise<void> {
  const items = readJson<{ events: SrcTimelineEvent[] }>('timeline.json').events;

  for (const [index, src] of items.entries()) {
    const data = {
      personId,
      date: src.date,
      title: src.title,
      subtitle: src.subtitle ?? null,
      description: src.description,
      type: toEnum(src.type, TimelineEventType, 'timeline_event.type', src.id),
      icon: src.icon ?? null,
      sortOrder: index,
    };
    await prisma.timelineEvent.upsert({
      where: { personId_legacyId: { personId, legacyId: src.id } },
      create: { legacyId: src.id, ...data },
      update: data,
    });
  }

  console.log(`  timeline_event   ${items.length}`);
}

async function seedManagementRoles(personId: string): Promise<void> {
  const items = readJson<{ responsibilities: SrcManagementRole[] }>(
    'management.json',
  ).responsibilities;
  let responsibilities = 0;
  let achievements = 0;

  for (const [index, src] of items.entries()) {
    const data = {
      personId,
      // Source data contains "medium", which the frontend interface does not declare.
      // Stored truthfully; see docs/MIGRATION-MAPPING.md §5.4.
      level: toEnum(src.level, ManagementLevel, 'mgmt_role.level', src.id),
      title: src.title,
      organization: src.organization,
      startDate: src.startDate,
      endDate: src.endDate ?? null,
      isCurrent: src.isCurrent,
      description: src.description,
      teamSize: src.teamSize ?? null,
      sortOrder: index,
    };

    const role = await prisma.managementRole.upsert({
      where: { personId_legacyId: { personId, legacyId: src.id } },
      create: { legacyId: src.id, ...data },
      update: data,
    });

    await prisma.managementResponsibilityItem.deleteMany({ where: { managementRoleId: role.id } });
    await prisma.managementAchievement.deleteMany({ where: { managementRoleId: role.id } });

    await prisma.managementResponsibilityItem.createMany({
      data: src.keyResponsibilities.map((description, i) => ({
        managementRoleId: role.id,
        description,
        sortOrder: i,
      })),
    });
    responsibilities += src.keyResponsibilities.length;

    await prisma.managementAchievement.createMany({
      data: src.achievements.map((description, i) => ({
        managementRoleId: role.id,
        description,
        sortOrder: i,
      })),
    });
    achievements += src.achievements.length;
  }

  console.log(
    `  mgmt_role         ${items.length}  (+${responsibilities} responsibilities, +${achievements} achievements)`,
  );
}

async function seedSkills(personId: string): Promise<void> {
  const categories = readJson<{ categories: SrcSkillCategory[] }>('skills.json').categories;
  let skills = 0;

  for (const [categoryIndex, srcCategory] of categories.entries()) {
    const category = await prisma.skillCategory.upsert({
      where: { personId_name: { personId, name: srcCategory.category } },
      create: { personId, name: srcCategory.category, sortOrder: categoryIndex },
      update: { sortOrder: categoryIndex },
    });

    await prisma.skill.deleteMany({ where: { categoryId: category.id } });

    // Deduplicate by name - the composite unique (categoryId, name) would reject repeats.
    const seen = new Set<string>();
    const rows = srcCategory.skills
      .filter((s) => {
        const key = s.name.trim().toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((s, i) => ({
        categoryId: category.id,
        name: s.name,
        // level 0 means "unranked" in the UI and must be preserved verbatim, not coerced.
        level: s.level,
        since: s.since ?? null,
        icon: s.icon ?? null,
        yearsOfExperience: s.yearsOfExperience ?? null,
        endorsements: s.endorsements ?? null,
        sortOrder: i,
      }));

    await prisma.skill.createMany({ data: rows });
    skills += rows.length;
  }

  console.log(`  skill_category   ${categories.length}  (+${skills} skills)`);
}

async function seedAdminUser(personId: string): Promise<void> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.log('  admin_user        -  (ADMIN_EMAIL / ADMIN_PASSWORD not set, skipped)');
    return;
  }

  if (password.length < 12) {
    throw new Error('ADMIN_PASSWORD must be at least 12 characters.');
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  await prisma.adminUser.upsert({
    where: { email },
    create: { email, passwordHash, name: 'Administrator', personId },
    // personId is deliberately not updated: moving an existing admin to a different tenant
    // should be an explicit act, not a side effect of re-running the seed.
    update: { passwordHash },
  });

  // The email is intentionally not logged.
  console.log('  admin_user        1  (credentials taken from environment)');
}

// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('\nImporting Angular static profile data -> PostgreSQL\n');

  const experiences = readJson<{ experiences: SrcExperience[] }>('experience.json').experiences;
  const projects = readJson<{ projects: SrcProject[] }>('projects.json').projects;

  const personId = await seedPerson();
  await seedContact(personId);

  const techIds = await seedTechnologies(personId, experiences, projects);
  await seedExperiences(personId, experiences, techIds);
  await seedProjects(personId, projects, techIds);

  await seedAchievements(personId);
  await seedCourses(personId);
  await seedTimeline(personId);
  await seedManagementRoles(personId);
  await seedSkills(personId);
  await seedAdminUser(personId);

  console.log('\nImport complete.\n');
}

main()
  .catch((error) => {
    console.error('\nSeed failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
