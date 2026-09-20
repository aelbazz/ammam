import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { SectionService } from './section.service';
import { SECTION_KEYS } from './section-registry';

describe('SectionService', () => {
  let service: SectionService;
  let prisma: {
    clientSection: { findMany: jest.Mock; update: jest.Mock };
    person: { findUnique: jest.Mock };
    contact: { count: jest.Mock };
    experience: { count: jest.Mock };
    project: { count: jest.Mock };
    skillCategory: { count: jest.Mock };
    achievement: { count: jest.Mock };
    course: { count: jest.Mock };
    timelineEvent: { count: jest.Mock };
    managementRole: { count: jest.Mock };
    $transaction: jest.Mock;
  };

  const rows = SECTION_KEYS.map((sectionKey, index) => ({
    id: `id-${sectionKey}`,
    tenantId: 't1',
    sectionKey,
    enabled: true,
    displayOrder: index + 1,
  }));

  beforeEach(async () => {
    prisma = {
      clientSection: { findMany: jest.fn().mockResolvedValue(rows), update: jest.fn() },
      person: { findUnique: jest.fn().mockResolvedValue({ id: 'p1' }) },
      contact: { count: jest.fn().mockResolvedValue(1) },
      experience: { count: jest.fn().mockResolvedValue(2) },
      project: { count: jest.fn().mockResolvedValue(3) },
      skillCategory: { count: jest.fn().mockResolvedValue(4) },
      achievement: { count: jest.fn().mockResolvedValue(5) },
      course: { count: jest.fn().mockResolvedValue(6) },
      timelineEvent: { count: jest.fn().mockResolvedValue(7) },
      managementRole: { count: jest.fn().mockResolvedValue(8) },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [SectionService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(SectionService);
  });

  it('seeds one row per registry key, enabled, in registry order', () => {
    const data = SectionService.defaultCreateData('tenant-1');
    expect(data).toHaveLength(SECTION_KEYS.length);
    expect(data.every((d) => d.enabled)).toBe(true);
    expect(data.map((d) => d.sectionKey)).toEqual(SECTION_KEYS);
    expect(data.map((d) => d.displayOrder)).toEqual(SECTION_KEYS.map((_, i) => i + 1));
  });

  it('returns every section with a label and a live item count', async () => {
    const result = await service.findAllForTenant('t1');

    expect(result).toHaveLength(SECTION_KEYS.length);
    expect(result.find((s) => s.sectionKey === 'projects')).toMatchObject({
      label: 'Projects',
      itemCount: 3,
    });
    expect(result.find((s) => s.sectionKey === 'profile')).toMatchObject({ itemCount: 1 });
  });

  it('returns zero counts when the tenant has no Person row yet', async () => {
    prisma.person.findUnique.mockResolvedValue(null);
    const result = await service.findAllForTenant('t1');
    expect(result.every((s) => s.itemCount === 0)).toBe(true);
  });

  it('updateOne rejects an unknown section key', async () => {
    await expect(service.updateOne('t1', 'nonexistent', true)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.clientSection.update).not.toHaveBeenCalled();
  });

  it('updateOne writes the enabled flag for a known key', async () => {
    await service.updateOne('t1', 'projects', false);
    expect(prisma.clientSection.update).toHaveBeenCalledWith({
      where: { tenantId_sectionKey: { tenantId: 't1', sectionKey: 'projects' } },
      data: { enabled: false },
    });
  });

  it('reorder rejects an unknown key', async () => {
    const entries = SECTION_KEYS.map((sectionKey, i) => ({ sectionKey, displayOrder: i + 1 }));
    entries[0] = { sectionKey: 'nonexistent', displayOrder: 1 };

    await expect(service.reorder('t1', { sections: entries })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('reorder rejects a duplicate key', async () => {
    const entries = SECTION_KEYS.map((sectionKey, i) => ({ sectionKey, displayOrder: i + 1 }));
    entries[1] = { ...entries[0] };

    await expect(service.reorder('t1', { sections: entries })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('reorder rejects a partial list missing a section', async () => {
    const entries = SECTION_KEYS.slice(0, -1).map((sectionKey, i) => ({
      sectionKey,
      displayOrder: i + 1,
    }));

    await expect(service.reorder('t1', { sections: entries })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('reorder writes every section inside one transaction', async () => {
    const entries = [...SECTION_KEYS].reverse().map((sectionKey, i) => ({
      sectionKey,
      displayOrder: i + 1,
    }));

    await service.reorder('t1', { sections: entries });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.clientSection.update).toHaveBeenCalledTimes(SECTION_KEYS.length);
  });
});
