import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CvVersion, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CV_SECTIONS, isValidCvSectionKey } from './cv-section-registry';
import { isValidCvTemplateId } from './cv-template-registry';
import { CreateCvVersionDto, UpdateCvVersionDto } from './dto/cv-version.dto';

/**
 * Owns CvVersion CRUD, always scoped by personId - the same `findFirst({ id, personId })`
 * ownership pattern already used by every other tenant-owned resource in this codebase (e.g.
 * SkillService, TechnologyService). A CV version belonging to a different tenant is a 404,
 * never a 403 - a caller cannot distinguish "not mine" from "does not exist".
 */
@Injectable()
export class CvVersionService {
  constructor(private readonly prisma: PrismaService) {}

  /** Seeded once per tenant in TenantService.create()'s onboarding transaction, and backfilled
   *  for pre-existing tenants by the migration that introduced this table. */
  static defaultCreateData(personId: string): Prisma.CvVersionUncheckedCreateInput {
    return {
      personId,
      name: 'General CV',
      isDefault: true,
      sectionConfig: CV_SECTIONS.map((s) => ({ key: s.key, enabled: true })),
    };
  }

  async findAll(personId: string): Promise<CvVersion[]> {
    return this.prisma.cvVersion.findMany({ where: { personId }, orderBy: { createdAt: 'asc' } });
  }

  async findOneOrThrow(personId: string, id: string): Promise<CvVersion> {
    const row = await this.prisma.cvVersion.findFirst({ where: { id, personId } });
    if (!row) throw new NotFoundException(`CV version ${id} not found`);
    return row;
  }

  async findDefault(personId: string): Promise<CvVersion> {
    const row = await this.prisma.cvVersion.findFirst({ where: { personId, isDefault: true } });
    if (!row) throw new NotFoundException('No default CV version for this profile');
    return row;
  }

  async create(personId: string, dto: CreateCvVersionDto): Promise<CvVersion> {
    this.validateConfig(dto);
    return this.prisma.cvVersion.create({
      data: {
        personId,
        name: dto.name,
        templateId: dto.templateId ?? 'ATS_CLASSIC',
        cvTitle: dto.cvTitle,
        cvSummary: dto.cvSummary,
        includePhone: dto.includePhone ?? true,
        includeEmail: dto.includeEmail ?? true,
        includeLinkedin: dto.includeLinkedin ?? true,
        includeGithub: dto.includeGithub ?? true,
        includePortfolio: dto.includePortfolio ?? true,
        includeManagement: dto.includeManagement ?? true,
        sectionConfig: this.toJsonSectionConfig(
          dto.sectionConfig ?? CV_SECTIONS.map((s) => ({ key: s.key, enabled: true })),
        ),
        excludedExperienceIds: dto.excludedExperienceIds ?? [],
        excludedProjectIds: dto.excludedProjectIds ?? [],
      },
    });
  }

  async update(personId: string, id: string, dto: UpdateCvVersionDto): Promise<CvVersion> {
    await this.findOneOrThrow(personId, id);
    this.validateConfig(dto);

    const data: Prisma.CvVersionUpdateInput = {
      ...dto,
      sectionConfig: dto.sectionConfig ? this.toJsonSectionConfig(dto.sectionConfig) : undefined,
    };
    return this.prisma.cvVersion.update({ where: { id }, data });
  }

  /** Plain `{key, enabled}` objects, not class-validator DTO instances - the only shape
   *  Prisma's Json input type accepts. */
  private toJsonSectionConfig(entries: { key: string; enabled: boolean }[]): Prisma.InputJsonValue {
    return entries.map((e) => ({ key: e.key, enabled: e.enabled }));
  }

  /** Refuses to delete a tenant's only version, or its current default while another version
   *  could take its place - a tenant (and the public download button) must always have
   *  something to show. */
  async remove(personId: string, id: string): Promise<void> {
    const target = await this.findOneOrThrow(personId, id);
    const count = await this.prisma.cvVersion.count({ where: { personId } });
    if (count <= 1) throw new BadRequestException('Cannot delete your only CV version');
    if (target.isDefault) {
      throw new BadRequestException('Set a different version as default before deleting this one');
    }
    await this.prisma.cvVersion.delete({ where: { id } });
  }

  async setDefault(personId: string, id: string): Promise<CvVersion> {
    await this.findOneOrThrow(personId, id);
    await this.prisma.$transaction([
      this.prisma.cvVersion.updateMany({ where: { personId }, data: { isDefault: false } }),
      this.prisma.cvVersion.update({ where: { id }, data: { isDefault: true } }),
    ]);
    return this.findOneOrThrow(personId, id);
  }

  private validateConfig(dto: CreateCvVersionDto | UpdateCvVersionDto): void {
    if (dto.templateId && !isValidCvTemplateId(dto.templateId)) {
      throw new BadRequestException(`Unknown CV template "${dto.templateId}"`);
    }
    if (dto.sectionConfig) {
      for (const entry of dto.sectionConfig) {
        if (!isValidCvSectionKey(entry.key)) {
          throw new BadRequestException(`Unknown CV section "${entry.key}"`);
        }
      }
      const keys = dto.sectionConfig.map((s) => s.key);
      if (new Set(keys).size !== keys.length) {
        throw new BadRequestException('Duplicate section key in sectionConfig');
      }
    }
  }
}
