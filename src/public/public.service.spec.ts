import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TenantStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantAccessService } from '../tenant-access/tenant-access.service';
import { PublicProfileService } from './public.service';

/**
 * These tests pin the response *contract* the Angular frontend depends on: child
 * collections must arrive as string arrays in sortOrder, no database metadata may appear
 * anywhere in the payload, and access is gated by TenantAccessService - not by the caller.
 */
describe('PublicProfileService', () => {
  let service: PublicProfileService;
  let prisma: { tenant: { findUnique: jest.Mock }; tenantSlugHistory: { findUnique: jest.Mock } };

  const tenantRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: 'tenant-db-id-should-not-leak',
    slug: 'ahmed',
    name: 'Ahmed Mohsen Albaz',
    status: TenantStatus.ACTIVE,
    createdById: null,
    coordinatorId: null,
    createdAt: new Date('2020-01-01'),
    updatedAt: new Date('2020-01-01'),
    subscription: { status: 'ACTIVE' },
    theme: null,
    settings: null,
    person: {
      id: 'person-db-id-should-not-leak',
      name: 'Ahmed Mohsen Albaz',
      title: 'Staff Engineer',
      summary: 'Summary',
      location: 'Riyadh, Saudi Arabia',
      yearsOfExperience: 13,
      avatar: '/assets/images/profile-image.jpg',
      tagline: 'Tagline',
      linkedin: 'https://www.linkedin.com/in/elbazz',
      birthday: 'June 26',
      contact: {
        id: 'c1',
        email: 'a@b.com',
        phone: '+1',
        whatsapp: '+1',
        linkedin: 'https://x.com',
        location: 'Riyadh',
        birthday: 'June 26',
        muchskills: null,
        socialLinks: [
          { platform: 'LinkedIn', url: 'https://l', icon: 'bi-linkedin' },
          { platform: 'GitHub', url: 'https://g', icon: 'bi-github' },
        ],
      },
      experiences: [
        {
          legacyId: 'exp1',
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
          responsibilities: [{ description: 'First' }, { description: 'Second' }],
          achievements: [{ description: 'Won something' }],
          technologies: [
            { technology: { name: 'Angular' } },
            { technology: { name: 'TypeScript' } },
          ],
        },
      ],
      projects: [
        {
          legacyId: 'proj1',
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
          highlights: [{ description: 'H1' }, { description: 'H2' }],
          technologies: [{ technology: { name: 'Angular' } }],
        },
      ],
      achievements: [
        {
          legacyId: 'ach1',
          title: 'T',
          description: 'D',
          date: '2025',
          category: 'award',
          organization: 'Org',
          icon: 'bi-trophy',
          articleUrl: null,
        },
      ],
      courses: [
        {
          legacyId: 'edu1',
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
          skills: [{ name: 'Programming' }, { name: 'Web' }],
        },
      ],
      timelineEvents: [
        {
          legacyId: 'evt1',
          date: 'Feb 2025',
          title: 'T',
          subtitle: 'S',
          description: 'D',
          type: 'achievement',
          icon: null,
        },
      ],
      managementRoles: [
        {
          legacyId: 'mgmt1',
          level: 'medium',
          title: 'Lead',
          organization: 'Org',
          startDate: 'Jan 2024',
          endDate: null,
          isCurrent: true,
          description: 'D',
          teamSize: null,
          keyResponsibilities: [{ description: 'R1' }],
          achievements: [{ description: 'A1' }],
        },
      ],
      skillCategories: [
        {
          name: 'Frontend Technologies',
          skills: [
            {
              name: 'Angular',
              level: 9,
              since: 2015,
              icon: null,
              yearsOfExperience: null,
              endorsements: null,
            },
            {
              name: 'Leadership',
              level: 0,
              since: 2017,
              icon: null,
              yearsOfExperience: null,
              endorsements: null,
            },
          ],
        },
      ],
    },
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      tenant: { findUnique: jest.fn() },
      tenantSlugHistory: { findUnique: jest.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        PublicProfileService,
        TenantAccessService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(PublicProfileService);
  });

  /** tenant.findUnique is called twice: once to resolve slug -> id, once to load the full
   *  graph. Both calls hit the same mock in these tests, so it always returns the full row. */
  function mockTenant(row: ReturnType<typeof tenantRow> | null) {
    prisma.tenant.findUnique.mockResolvedValue(row);
  }

  it('resolves a live slug and returns every top-level section', async () => {
    mockTenant(tenantRow());
    const { profile } = await service.resolveBySlug('ahmed');

    expect(Object.keys(profile)).toEqual([
      'tenant',
      'person',
      'contact',
      'experiences',
      'projects',
      'achievements',
      'courses',
      'timelineEvents',
      'managementRoles',
      'skills',
      'theme',
      'settings',
    ]);
  });

  it('exposes only the public tenant slug and name, never the internal id', async () => {
    mockTenant(tenantRow());
    const { profile } = await service.resolveBySlug('ahmed');

    expect(profile.tenant).toEqual({ slug: 'ahmed', name: 'Ahmed Mohsen Albaz' });
  });

  it('is case-insensitive: an uppercase slug resolves the same lower-cased tenant', async () => {
    mockTenant(tenantRow());
    await service.resolveBySlug('AHMED');

    expect(prisma.tenant.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: 'ahmed' } }),
    );
  });

  it('exposes the frontend legacy id as `id`, not the database id', async () => {
    mockTenant(tenantRow());
    const { profile } = await service.resolveBySlug('ahmed');

    expect(profile.experiences[0].id).toBe('exp1');
    expect(profile.projects[0].id).toBe('proj1');
  });

  it('flattens responsibilities, highlights and technologies to plain arrays', async () => {
    mockTenant(tenantRow());
    const { profile } = await service.resolveBySlug('ahmed');

    expect(profile.experiences[0].responsibilities).toEqual(['First', 'Second']);
    expect(profile.experiences[0].technologies).toEqual(['Angular', 'TypeScript']);
    expect(profile.projects[0].highlights).toEqual(['H1', 'H2']);
  });

  it('preserves skill level 0 and the "medium" management level the frontend interface omits', async () => {
    mockTenant(tenantRow());
    const { profile } = await service.resolveBySlug('ahmed');

    const leadership = profile.skills.categories[0].skills.find((s) => s.name === 'Leadership');
    expect(leadership?.level).toBe(0);
    expect(profile.managementRoles[0].level).toBe('medium');
  });

  it('leaks no database metadata anywhere in the payload', async () => {
    mockTenant(tenantRow());
    const { profile } = await service.resolveBySlug('ahmed');
    const serialised = JSON.stringify(profile);

    expect(serialised).not.toContain('tenant-db-id-should-not-leak');
    expect(serialised).not.toContain('person-db-id-should-not-leak');
    expect(serialised).not.toContain('isPublished');
    expect(serialised).not.toContain('personId');
    expect(serialised).not.toContain('createdAt');
  });

  it('throws NotFound for an unregistered and unretired slug', async () => {
    mockTenant(null);
    prisma.tenantSlugHistory.findUnique.mockResolvedValue(null);

    await expect(service.resolveBySlug('nobody')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('follows a retired slug via history and reports the redirect', async () => {
    prisma.tenant.findUnique
      .mockResolvedValueOnce(null) // live lookup by the old slug misses
      .mockResolvedValue(tenantRow()); // subsequent lookups by id succeed
    prisma.tenantSlugHistory.findUnique.mockResolvedValue({
      tenantId: 'tenant-db-id-should-not-leak',
    });

    const result = await service.resolveBySlug('old-slug');

    expect(result.redirectedFromSlug).toBe('old-slug');
    expect(result.profile.tenant.slug).toBe('ahmed');
  });

  it('does not consult history when the slug is live', async () => {
    mockTenant(tenantRow());
    await service.resolveBySlug('ahmed');

    expect(prisma.tenantSlugHistory.findUnique).not.toHaveBeenCalled();
  });

  it.each([
    ['PENDING tenant', tenantRow({ status: TenantStatus.PENDING })],
    ['SUSPENDED tenant', tenantRow({ status: TenantStatus.SUSPENDED })],
    ['ARCHIVED tenant', tenantRow({ status: TenantStatus.ARCHIVED })],
    ['EXPIRED subscription', tenantRow({ subscription: { status: 'EXPIRED' } })],
    ['SUSPENDED subscription', tenantRow({ subscription: { status: 'SUSPENDED' } })],
    ['no subscription at all', tenantRow({ subscription: null })],
  ])('hides the profile for %s behind the same 404 as an unknown slug', async (_label, row) => {
    mockTenant(row);
    await expect(service.resolveBySlug('ahmed')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('still serves a TRIAL or PAST_DUE tenant (grace period)', async () => {
    mockTenant(tenantRow({ subscription: { status: 'TRIAL' } }));
    await expect(service.resolveBySlug('ahmed')).resolves.toBeDefined();

    mockTenant(tenantRow({ subscription: { status: 'PAST_DUE' } }));
    await expect(service.resolveBySlug('ahmed')).resolves.toBeDefined();
  });

  it('falls back to theme/settings defaults when a tenant has not customised them', async () => {
    mockTenant(tenantRow({ theme: null, settings: null }));
    const { profile } = await service.resolveBySlug('ahmed');

    expect(profile.theme.primaryColor).toBe('#6366f1');
    expect(profile.settings.websiteTitle).toBe('Ahmed Mohsen Albaz'); // falls back to tenant.name
  });

  it('produces a stable ETag that changes with the content', async () => {
    mockTenant(tenantRow());
    const { profile } = await service.resolveBySlug('ahmed');
    const etag = service.computeETag(profile);

    expect(etag).toMatch(/^"[A-Za-z0-9_-]{32}"$/);
    expect(service.computeETag(profile)).toBe(etag);

    const changed = { ...profile, person: { ...profile.person, name: 'Someone Else' } };
    expect(service.computeETag(changed)).not.toBe(etag);
  });
});
