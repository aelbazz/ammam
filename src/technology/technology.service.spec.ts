import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TechnologyService, technologySlug } from './technology.service';

describe('technologySlug', () => {
  it('normalises case and punctuation so equivalent names collapse to one key', () => {
    expect(technologySlug('Node.js')).toBe('node-js');
    expect(technologySlug('node js')).toBe('node-js');
    expect(technologySlug('  NODE.JS  ')).toBe('node-js');
  });

  it('keeps genuinely different technologies apart', () => {
    expect(technologySlug('Angular')).not.toBe(technologySlug('AngularJS'));
    expect(technologySlug('Java')).not.toBe(technologySlug('JavaScript'));
  });

  it('strips leading and trailing separators', () => {
    expect(technologySlug('.NET')).toBe('net');
    expect(technologySlug('C++')).toBe('c');
  });
});

describe('TechnologyService', () => {
  const TENANT = 'tenant-1';

  let service: TechnologyService;
  let prisma: {
    technology: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      upsert: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      technology: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [TechnologyService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(TechnologyService);
  });

  it('scopes the upsert to the tenant, so two profiles can each own an "Angular"', async () => {
    prisma.technology.upsert.mockResolvedValue({ id: 't1', name: 'Angular', slug: 'angular' });

    await service.create('tenant-A', { name: 'Angular' });
    await service.create('tenant-B', { name: 'Angular' });

    const [first, second] = prisma.technology.upsert.mock.calls;
    expect(first[0].where.personId_slug.personId).toBe('tenant-A');
    expect(second[0].where.personId_slug.personId).toBe('tenant-B');
  });

  it('upserts on the normalised slug so creating an existing technology does not duplicate', async () => {
    prisma.technology.upsert.mockResolvedValue({ id: 't1', name: 'Node.js', slug: 'node-js' });

    await service.create(TENANT, { name: 'node js' });

    expect(prisma.technology.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { personId_slug: { personId: TENANT, slug: 'node-js' } } }),
    );
  });

  it('resolveByName returns the existing id rather than creating a second row', async () => {
    prisma.technology.upsert.mockResolvedValue({ id: 'existing-id' });

    await expect(service.resolveByName(TENANT, '  Angular ')).resolves.toBe('existing-id');
    expect(prisma.technology.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { personId_slug: { personId: TENANT, slug: 'angular' } },
        update: {},
      }),
    );
  });

  it('trims the display name but preserves its casing', async () => {
    prisma.technology.upsert.mockResolvedValue({
      id: 't1',
      name: 'TypeScript',
      slug: 'typescript',
    });

    await service.create(TENANT, { name: '  TypeScript  ' });

    expect(prisma.technology.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { personId: TENANT, name: 'TypeScript', slug: 'typescript' },
      }),
    );
  });

  it('throws NotFound for an unknown id', async () => {
    prisma.technology.findFirst.mockResolvedValue(null);
    await expect(service.findOne(TENANT, 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
