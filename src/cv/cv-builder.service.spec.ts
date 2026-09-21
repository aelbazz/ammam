import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CvVersion } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CvBuilderService } from './cv-builder.service';

describe('CvBuilderService', () => {
  let service: CvBuilderService;
  let prisma: {
    person: { findUnique: jest.Mock };
    experience: { findMany: jest.Mock };
    managementRole: { findMany: jest.Mock };
    skillCategory: { findMany: jest.Mock };
    project: { findMany: jest.Mock };
    timelineEvent: { findMany: jest.Mock };
    course: { findMany: jest.Mock };
    achievement: { findMany: jest.Mock };
  };

  const person = {
    id: 'person-1',
    name: 'Ahmed Mohsen Albaz',
    title: 'Staff Engineer',
    summary: 'A long professional summary.',
    location: 'Riyadh, Saudi Arabia',
    contact: {
      email: 'a@b.com',
      phone: '+1',
      linkedin: 'https://linkedin.com/in/elbazz',
      location: 'Riyadh, Saudi Arabia',
      socialLinks: [
        { platform: 'GitHub', url: 'https://github.com/aelbazz' },
        { platform: 'LinkedIn', url: 'https://linkedin.com/in/elbazz' },
      ],
    },
  };

  const baseVersion: CvVersion = {
    id: 'v1',
    personId: 'person-1',
    name: 'General CV',
    isDefault: true,
    templateId: 'ATS_CLASSIC',
    cvTitle: null,
    cvSummary: null,
    includePhone: true,
    includeEmail: true,
    includeLinkedin: true,
    includeGithub: true,
    includePortfolio: true,
    includeManagement: true,
    sectionConfig: [
      { key: 'experience', enabled: true },
      { key: 'skills', enabled: true },
      { key: 'projects', enabled: true },
      { key: 'education', enabled: true },
      { key: 'courses', enabled: true },
      { key: 'achievements', enabled: true },
    ],
    excludedExperienceIds: [],
    excludedProjectIds: [],
    experienceOrder: null,
    projectOrder: null,
    targetRole: null,
    jobDescription: null,
    targetCompany: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as CvVersion;

  beforeEach(async () => {
    prisma = {
      person: { findUnique: jest.fn().mockResolvedValue(person) },
      experience: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'e1',
            company: 'THIQAH',
            position: 'Staff Developer',
            location: 'Riyadh',
            startDate: 'Jan 2024',
            endDate: null,
            isCurrent: true,
            responsibilities: [{ description: 'Led the team' }],
            achievements: [],
            technologies: [
              { technology: { name: 'Angular' } },
              { technology: { name: 'TypeScript' } },
            ],
          },
          {
            id: 'e2',
            company: 'Naseej',
            position: 'Senior Developer',
            location: 'Cairo',
            startDate: 'Aug 2017',
            endDate: 'Jun 2019',
            isCurrent: false,
            responsibilities: [{ description: 'Built things' }],
            achievements: [],
            technologies: [],
          },
        ]),
      },
      managementRole: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'm1',
            organization: 'THIQAH',
            title: 'Team Lead',
            startDate: 'Sep 2022',
            endDate: 'Dec 2023',
            isCurrent: false,
            keyResponsibilities: [{ description: 'Managed 5 engineers' }],
            achievements: [],
          },
        ]),
      },
      skillCategory: {
        findMany: jest.fn().mockResolvedValue([
          { name: 'Frontend Technologies', skills: [{ name: 'Angular' }, { name: 'TypeScript' }] },
          { name: 'Empty Category', skills: [] },
        ]),
      },
      project: { findMany: jest.fn().mockResolvedValue([]) },
      timelineEvent: { findMany: jest.fn().mockResolvedValue([]) },
      course: { findMany: jest.fn().mockResolvedValue([]) },
      achievement: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [CvBuilderService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(CvBuilderService);
  });

  it('throws NotFoundException when the person does not exist', async () => {
    prisma.person.findUnique.mockResolvedValue(null);
    await expect(service.build('missing', baseVersion)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('never includes internal ids in the document metadata', async () => {
    const doc = await service.build('person-1', baseVersion);
    expect(doc.meta.author).toBe('Ahmed Mohsen Albaz');
    expect(JSON.stringify(doc.meta)).not.toContain('person-1');
  });

  it('omits an empty section from sectionOrder entirely, never an empty heading', async () => {
    const doc = await service.build('person-1', baseVersion);
    // projects/education/courses/achievements all mocked empty above.
    expect(doc.sectionOrder).not.toContain('projects');
    expect(doc.sectionOrder).not.toContain('education');
    expect(doc.sectionOrder).not.toContain('courses');
    expect(doc.sectionOrder).not.toContain('achievements');
    expect(doc.sectionOrder).toContain('experience');
    expect(doc.sectionOrder).toContain('skills');
  });

  it('omits a section from sectionOrder when disabled in sectionConfig, even with data', async () => {
    const version = {
      ...baseVersion,
      sectionConfig: baseVersion.sectionConfig
        ? (baseVersion.sectionConfig as Array<{ key: string; enabled: boolean }>).map((s) =>
            s.key === 'skills' ? { ...s, enabled: false } : s,
          )
        : [],
    } as CvVersion;
    const doc = await service.build('person-1', version);
    expect(doc.sectionOrder).not.toContain('skills');
  });

  it('merges ManagementRole into experience and sorts both by date, newest first', async () => {
    const doc = await service.build('person-1', baseVersion);
    expect(doc.experience).toHaveLength(3);
    // e1 (Jan 2024, current) newest, then m1 (Sep 2022), then e2 (Aug 2017).
    expect(doc.experience[0].organization).toBe('THIQAH');
    expect(doc.experience[0].role).toBe('Staff Developer');
    expect(doc.experience[0].dateRange).toBe('Jan 2024 – Present');
    expect(doc.experience[1].role).toBe('Team Lead');
    expect(doc.experience[2].organization).toBe('Naseej');
  });

  it('excludes ManagementRole entirely when includeManagement is false', async () => {
    const version = { ...baseVersion, includeManagement: false } as CvVersion;
    const doc = await service.build('person-1', version);
    expect(doc.experience.every((e) => e.role !== 'Team Lead')).toBe(true);
    expect(prisma.managementRole.findMany).not.toHaveBeenCalled();
  });

  it("queries experience/projects excluding this version's excluded ids", async () => {
    const version = { ...baseVersion, excludedExperienceIds: ['e2'] } as CvVersion;
    await service.build('person-1', version);
    expect(prisma.experience.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { notIn: ['e2'] } }) }),
    );
  });

  it('builds skill groups from SkillCategory, dropping categories with no skills', async () => {
    const doc = await service.build('person-1', baseVersion);
    expect(doc.skills).toEqual([
      { category: 'Frontend Technologies', skills: ['Angular', 'TypeScript'] },
    ]);
  });

  it('resolves GitHub from ContactSocialLink by platform, case-insensitively', async () => {
    const doc = await service.build('person-1', baseVersion);
    const github = doc.header.contacts.find((c) => c.label === 'GitHub');
    expect(github?.href).toBe('https://github.com/aelbazz');
  });

  it('does not include LinkedIn twice (Contact.linkedin, not the duplicate ContactSocialLink row)', async () => {
    const doc = await service.build('person-1', baseVersion);
    expect(doc.header.contacts.filter((c) => c.label === 'LinkedIn')).toHaveLength(1);
  });

  it('contributes nothing for a toggle with no matching link, never erroring', async () => {
    const doc = await service.build('person-1', baseVersion); // no 'portfolio' platform in fixture
    expect(doc.header.contacts.find((c) => c.label === 'Portfolio')).toBeUndefined();
  });

  it('falls back to Person.summary when cvSummary is not set', async () => {
    const doc = await service.build('person-1', baseVersion);
    expect(doc.summary).toBe('A long professional summary.');
  });

  it('uses cvSummary when set, overriding Person.summary', async () => {
    const version = { ...baseVersion, cvSummary: 'A CV-specific summary.' } as CvVersion;
    const doc = await service.build('person-1', version);
    expect(doc.summary).toBe('A CV-specific summary.');
  });

  it('uses cvTitle as the header headline when set, otherwise Person.title', async () => {
    const doc = await service.build('person-1', baseVersion);
    expect(doc.header.headline).toBe('Staff Engineer');

    const version = { ...baseVersion, cvTitle: 'AI Product Engineer' } as CvVersion;
    const overridden = await service.build('person-1', version);
    expect(overridden.header.headline).toBe('AI Product Engineer');
  });
});
