import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SECTION_KEYS, isValidSectionKey, sectionLabel } from './section-registry';
import { ReorderSectionsDto, SectionResponseDto } from './dto/section.dto';

/**
 * ClientSection rows are seeded once per tenant during onboarding (TenantService.create) -
 * see seedDefaults(), called from there - so findAllForTenant never needs to create rows on
 * the fly and a missing row for a known key is a genuine data problem, not "not configured
 * yet".
 */
@Injectable()
export class SectionService {
  constructor(private readonly prisma: PrismaService) {}

  /** Called once, inside TenantService.create()'s onboarding transaction. */
  static defaultCreateData(tenantId: string) {
    return SECTION_KEYS.map((sectionKey, index) => ({
      tenantId,
      sectionKey,
      enabled: true,
      displayOrder: index + 1,
    }));
  }

  async findAllForTenant(tenantId: string): Promise<SectionResponseDto[]> {
    const [rows, itemCounts] = await Promise.all([
      this.prisma.clientSection.findMany({
        where: { tenantId },
        orderBy: { displayOrder: 'asc' },
      }),
      this.countItemsByKey(tenantId),
    ]);

    return rows.map((row) => ({
      sectionKey: row.sectionKey,
      label: sectionLabel(row.sectionKey),
      enabled: row.enabled,
      displayOrder: row.displayOrder,
      itemCount: itemCounts[row.sectionKey] ?? 0,
    }));
  }

  async updateOne(
    tenantId: string,
    sectionKey: string,
    enabled: boolean,
  ): Promise<SectionResponseDto[]> {
    if (!isValidSectionKey(sectionKey)) {
      throw new BadRequestException(`Unknown section "${sectionKey}"`);
    }

    await this.prisma.clientSection.update({
      where: { tenantId_sectionKey: { tenantId, sectionKey } },
      data: { enabled },
    });

    return this.findAllForTenant(tenantId);
  }

  async reorder(tenantId: string, dto: ReorderSectionsDto): Promise<SectionResponseDto[]> {
    const keys = dto.sections.map((s) => s.sectionKey);

    for (const key of keys) {
      if (!isValidSectionKey(key)) throw new BadRequestException(`Unknown section "${key}"`);
    }
    if (new Set(keys).size !== keys.length) {
      throw new BadRequestException('Duplicate sectionKey in reorder request');
    }
    if (keys.length !== SECTION_KEYS.length || !SECTION_KEYS.every((k) => keys.includes(k))) {
      throw new BadRequestException('Reorder must include every section exactly once');
    }

    await this.prisma.$transaction(
      dto.sections.map((entry) =>
        this.prisma.clientSection.update({
          where: { tenantId_sectionKey: { tenantId, sectionKey: entry.sectionKey } },
          data: { displayOrder: entry.displayOrder },
        }),
      ),
    );

    return this.findAllForTenant(tenantId);
  }

  /**
   * Live counts, not stored - itemCount is derived data. "profile" and "contact" are
   * single-record sections rather than collections, so their count is presence (0 or 1)
   * instead of a row count.
   */
  private async countItemsByKey(tenantId: string): Promise<Record<string, number>> {
    const person = await this.prisma.person.findUnique({
      where: { tenantId },
      select: { id: true },
    });
    if (!person) return {};
    const personId = person.id;

    const [
      contact,
      experience,
      projects,
      skillCategories,
      achievements,
      courses,
      timeline,
      management,
    ] = await Promise.all([
      this.prisma.contact.count({ where: { personId } }),
      this.prisma.experience.count({ where: { personId } }),
      this.prisma.project.count({ where: { personId } }),
      this.prisma.skillCategory.count({ where: { personId } }),
      this.prisma.achievement.count({ where: { personId } }),
      this.prisma.course.count({ where: { personId } }),
      this.prisma.timelineEvent.count({ where: { personId } }),
      this.prisma.managementRole.count({ where: { personId } }),
    ]);

    return {
      profile: 1,
      contact,
      experience,
      projects,
      skills: skillCategories,
      achievements,
      courses,
      timeline,
      management,
    };
  }
}
