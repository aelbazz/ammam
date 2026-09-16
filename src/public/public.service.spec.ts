import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PublicProfileService } from './public.service';

/**
 * These tests pin the response *contract* the Angular frontend depends on: child
 * collections must arrive as string arrays in sortOrder, and no database metadata may
 * appear anywhere in the payload.
 */
describe('PublicProfileService', () => {
  let service: PublicProfileService;
  let prisma: { person: { findUnique: jest.Mock } };

  const personRow = {
    id: 'db-id-should-not-leak',
    slug: 'default',
    name: 'Ahmed Mohsen Albaz',
    title: 'Staff Engineer',
    summary: 'Summary',
    location: 'Riyadh, Saudi Arabia',
    yearsOfExperience: 13,
    avatar: '/assets/images/profile-image.jpg',
    tagline: 'Tagline',
    linkedin: 'https://www.linkedin.com/in/elbazz',
    birthday: 'June 26',
    createdAt: new Date('2020-01-01'),
    updatedAt: new Date('2020-01-01'),
    contact: {
      id: 'c1',
      personId: 'db-id-should-not-leak',
      email: 'a@b.com',
      phone: '+1',
      whatsapp: '+1',
      linkedin: 'https://x.com',
      location: 'Riyadh',
      birthday: 'June 26',
      muchskills: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      socialLinks: [
        {
          id: 's1',
          contactId: 'c1',
          platform: 'LinkedIn',
          url: 'https://l',
          icon: 'bi-linkedin',
          sortOrder: 0,
        },
        {
          id: 's2',
          contactId: 'c1',
          platform: 'GitHub',
          url: 'https://g',
          icon: 'bi-github',
          sortOrder: 1,
        },
      ],
    },
    experiences: [
      {
        id: 'e1',
        legacyId: 'exp1',
        personId: 'p',
        company: 'THIQAH',
        companyFullName: null,
        companyLogo: null,
        companyWebsite: null,
        companyDescription: null,
        position: 'Staff Developer',
        location: 'Riyadh',
        startDate: 'Jan 2024',
        endDate: null,
        isCurrent: true,
        description: 'desc',
        sortOrder: 0,
        isPublished: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        responsibilities: [{ description: 'First' }, { description: 'Second' }],
        achievements: [{ description: 'Won something' }],
        technologies: [{ technology: { name: 'Angular' } }, { technology: { name: 'TypeScript' } }],
      },
    ],
    projects: [
      {
        id: 'pr1',
        legacyId: 'proj1',
        personId: 'p',
        name: 'iHealth',
        description: 'd',
        role: 'Staff',
        startDate: '2024',
        endDate: null,
        type: 'Strategic',
        company: 'THIQAH',
        isCurrent: true,
        isStrategicInitiative: true,
        imageUrl: null,
        githubUrl: null,
        liveUrl: null,
        sortOrder: 0,
        isPublished: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        highlights: [{ description: 'H1' }, { description: 'H2' }],
        technologies: [{ technology: { name: 'Angular' } }],
      },
    ],
    achievements: [
      {
        id: 'a1',
        legacyId: 'ach1',
        personId: 'p',
        title: 'T',
        description: 'D',
        date: '2025',
        category: 'award',
        organization: 'Org',
        icon: 'bi-trophy',
        articleUrl: null,
        sortOrder: 0,
        isPublished: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    courses: [
      {
        id: 'co1',
        legacyId: 'edu1',
        personId: 'p',
        title: 'C',
        provider: 'P',
        completionDate: '2016',
        level: 'Diploma',
        description: null,
        duration: null,
        instructor: null,
        courseUrl: null,
        certificateUrl: null,
        startDate: null,
        grade: null,
        sortOrder: 0,
        isPublished: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        skills: [{ name: 'Programming' }, { name: 'Web' }],
      },
    ],
    timelineEvents: [
      {
        id: 't1',
        legacyId: 'evt1',
        personId: 'p',
        date: 'Feb 2025',
        title: 'T',
        subtitle: 'S',
        description: 'D',
        type: 'achievement',
        icon: null,
        sortOrder: 0,
        isPublished: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    managementRoles: [
      {
        id: 'm1',
        legacyId: 'mgmt1',
        personId: 'p',
        level: 'medium',
        title: 'Lead',
        organization: 'Org',
        startDate: 'Jan 2024',
        endDate: null,
        isCurrent: true,
        description: 'D',
        teamSize: null,
        sortOrder: 0,
        isPublished: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        keyResponsibilities: [{ description: 'R1' }],
        achievements: [{ description: 'A1' }],
      },
    ],
    skillCategories: [
      {
        id: 'sc1',
        personId: 'p',
        name: 'Frontend Technologies',
        sortOrder: 0,
        isPublished: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        skills: [
          {
            id: 'sk1',
            categoryId: 'sc1',
            name: 'Angular',
            level: 9,
            since: 2015,
            icon: null,
            yearsOfExperience: null,
            endorsements: null,
            sortOrder: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'sk2',
            categoryId: 'sc1',
            name: 'Leadership',
            level: 0,
            since: 2017,
            icon: null,
            yearsOfExperience: null,
            endorsements: null,
            sortOrder: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      },
    ],
  };

  beforeEach(async () => {
    prisma = { person: { findUnique: jest.fn().mockResolvedValue(personRow) } };
    const moduleRef = await Test.createTestingModule({
      providers: [PublicProfileService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(PublicProfileService);
  });

  it('returns every top-level section', async () => {
    const result = await service.getPublicProfile();
    expect(Object.keys(result)).toEqual([
      'person',
      'contact',
      'experiences',
      'projects',
      'achievements',
      'courses',
      'timelineEvents',
      'managementRoles',
      'skills',
    ]);
  });

  it('exposes the frontend legacy id as `id`, not the database id', async () => {
    const result = await service.getPublicProfile();
    expect(result.experiences[0].id).toBe('exp1');
    expect(result.projects[0].id).toBe('proj1');
    expect(result.achievements[0].id).toBe('ach1');
    expect(result.timelineEvents[0].id).toBe('evt1');
  });

  it('flattens responsibilities and highlights to string arrays', async () => {
    const result = await service.getPublicProfile();
    expect(result.experiences[0].responsibilities).toEqual(['First', 'Second']);
    expect(result.experiences[0].achievements).toEqual(['Won something']);
    expect(result.projects[0].highlights).toEqual(['H1', 'H2']);
    expect(result.courses[0].skills).toEqual(['Programming', 'Web']);
    expect(result.managementRoles[0].keyResponsibilities).toEqual(['R1']);
  });

  it('flattens technologies to plain names', async () => {
    const result = await service.getPublicProfile();
    expect(result.experiences[0].technologies).toEqual(['Angular', 'TypeScript']);
    expect(result.projects[0].technologies).toEqual(['Angular']);
  });

  it('shapes skills as { categories: [...] } to match the frontend SkillData interface', async () => {
    const result = await service.getPublicProfile();
    expect(result.skills.categories).toHaveLength(1);
    expect(result.skills.categories[0].category).toBe('Frontend Technologies');
    // category is denormalised onto each skill, as the frontend Skill model expects.
    expect(result.skills.categories[0].skills[0].category).toBe('Frontend Technologies');
  });

  it('preserves skill level 0 rather than coercing it', async () => {
    const result = await service.getPublicProfile();
    const leadership = result.skills.categories[0].skills.find((s) => s.name === 'Leadership');
    expect(leadership?.level).toBe(0);
  });

  it('preserves the management level "medium" that the frontend interface omits', async () => {
    const result = await service.getPublicProfile();
    expect(result.managementRoles[0].level).toBe('medium');
  });

  it('leaks no database metadata anywhere in the payload', async () => {
    const serialised = JSON.stringify(await service.getPublicProfile());
    expect(serialised).not.toContain('db-id-should-not-leak');
    expect(serialised).not.toContain('isPublished');
    expect(serialised).not.toContain('sortOrder');
    expect(serialised).not.toContain('personId');
    expect(serialised).not.toContain('createdAt');
    expect(serialised).not.toContain('updatedAt');
    expect(serialised).not.toContain('legacyId');
  });

  it('requests published rows only, ordered by sortOrder', async () => {
    await service.getPublicProfile();
    const include = prisma.person.findUnique.mock.calls[0][0].include;

    for (const key of [
      'experiences',
      'projects',
      'achievements',
      'courses',
      'timelineEvents',
      'managementRoles',
      'skillCategories',
    ]) {
      expect(include[key].where).toEqual({ isPublished: true });
      expect(include[key].orderBy).toEqual({ sortOrder: 'asc' });
    }
  });

  it('loads the whole profile in a single Prisma query', async () => {
    await service.getPublicProfile();
    expect(prisma.person.findUnique).toHaveBeenCalledTimes(1);
  });

  it('throws NotFound when the profile has not been seeded', async () => {
    prisma.person.findUnique.mockResolvedValue(null);
    await expect(service.getPublicProfile()).rejects.toBeInstanceOf(NotFoundException);
  });

  it('produces a stable ETag that changes with the content', async () => {
    const profile = await service.getPublicProfile();
    const etag = service.computeETag(profile);

    expect(etag).toMatch(/^"[A-Za-z0-9_-]{32}"$/);
    expect(service.computeETag(profile)).toBe(etag);

    const changed = { ...profile, person: { ...profile.person, name: 'Someone Else' } };
    expect(service.computeETag(changed)).not.toBe(etag);
  });
});
