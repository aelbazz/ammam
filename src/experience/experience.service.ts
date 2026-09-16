import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TechnologyService } from '../technology/technology.service';
import { PersonService } from '../person/person.service';
import {
  ChildItemResponseDto,
  CreateChildItemDto,
  CreateExperienceDto,
  ExperienceResponseDto,
  ReorderDto,
  UpdateChildItemDto,
  UpdateExperienceDto,
} from './dto/experience.dto';
import { AttachTechnologyDto } from '../technology/dto/technology.dto';

const byOrder = { sortOrder: 'asc' } as const;

const experienceInclude = {
  responsibilities: { orderBy: byOrder },
  achievements: { orderBy: byOrder },
  technologies: { orderBy: byOrder, include: { technology: true } },
} satisfies Prisma.ExperienceInclude;

type ExperienceWithRelations = Prisma.ExperienceGetPayload<{ include: typeof experienceInclude }>;

@Injectable()
export class ExperienceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly technologyService: TechnologyService,
    private readonly personService: PersonService,
  ) {}

  async findAll(includeUnpublished = true): Promise<ExperienceResponseDto[]> {
    const rows = await this.prisma.experience.findMany({
      where: includeUnpublished ? {} : { isPublished: true },
      orderBy: byOrder,
      include: experienceInclude,
    });
    return rows.map((r) => this.toDto(r));
  }

  async findOne(id: string): Promise<ExperienceResponseDto> {
    return this.toDto(await this.findEntity(id));
  }

  async create(dto: CreateExperienceDto): Promise<ExperienceResponseDto> {
    const personId = await this.personService.getDefaultPersonId();
    const { responsibilities, achievements, technologies, legacyId, sortOrder, ...rest } = dto;

    const technologyIds = await this.resolveTechnologies(technologies);

    const created = await this.prisma.experience.create({
      data: {
        ...rest,
        personId,
        legacyId: legacyId ?? (await this.nextLegacyId()),
        sortOrder: sortOrder ?? (await this.nextSortOrder(personId)),
        responsibilities: {
          create: (responsibilities ?? []).map((description, i) => ({ description, sortOrder: i })),
        },
        achievements: {
          create: (achievements ?? []).map((description, i) => ({ description, sortOrder: i })),
        },
        technologies: {
          create: technologyIds.map((technologyId, i) => ({ technologyId, sortOrder: i })),
        },
      },
      include: experienceInclude,
    });

    return this.toDto(created);
  }

  /**
   * Scalar fields are patched. A child array is only touched when the caller actually sends
   * it - omitting `responsibilities` leaves them alone, sending `[]` clears them. Without
   * that distinction a PATCH of the job title would silently wipe the responsibilities.
   */
  async update(id: string, dto: UpdateExperienceDto): Promise<ExperienceResponseDto> {
    await this.findEntity(id);
    const { responsibilities, achievements, technologies, ...rest } = dto;

    const technologyIds = technologies ? await this.resolveTechnologies(technologies) : undefined;

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.experience.update({ where: { id }, data: rest });

      if (responsibilities) {
        await tx.experienceResponsibility.deleteMany({ where: { experienceId: id } });
        await tx.experienceResponsibility.createMany({
          data: responsibilities.map((description, i) => ({
            experienceId: id,
            description,
            sortOrder: i,
          })),
        });
      }

      if (achievements) {
        await tx.experienceAchievement.deleteMany({ where: { experienceId: id } });
        await tx.experienceAchievement.createMany({
          data: achievements.map((description, i) => ({
            experienceId: id,
            description,
            sortOrder: i,
          })),
        });
      }

      if (technologyIds) {
        await tx.experienceTechnology.deleteMany({ where: { experienceId: id } });
        await tx.experienceTechnology.createMany({
          data: technologyIds.map((technologyId, i) => ({
            experienceId: id,
            technologyId,
            sortOrder: i,
          })),
        });
      }

      return tx.experience.findUniqueOrThrow({ where: { id }, include: experienceInclude });
    });

    return this.toDto(updated);
  }

  async remove(id: string): Promise<void> {
    await this.findEntity(id);
    await this.prisma.experience.delete({ where: { id } });
  }

  async reorder(dto: ReorderDto): Promise<void> {
    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.experience.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
        }),
      ),
    );
  }

  // -- responsibilities -------------------------------------------------------

  async addResponsibility(
    experienceId: string,
    dto: CreateChildItemDto,
  ): Promise<ChildItemResponseDto> {
    await this.findEntity(experienceId);
    const sortOrder = dto.sortOrder ?? (await this.nextChildOrder('responsibility', experienceId));

    return this.prisma.experienceResponsibility.create({
      data: { experienceId, description: dto.description, sortOrder },
      select: { id: true, description: true, sortOrder: true },
    });
  }

  async updateResponsibility(id: string, dto: UpdateChildItemDto): Promise<ChildItemResponseDto> {
    const existing = await this.prisma.experienceResponsibility.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Responsibility ${id} not found`);

    return this.prisma.experienceResponsibility.update({
      where: { id },
      data: dto,
      select: { id: true, description: true, sortOrder: true },
    });
  }

  async removeResponsibility(id: string): Promise<void> {
    const existing = await this.prisma.experienceResponsibility.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Responsibility ${id} not found`);
    await this.prisma.experienceResponsibility.delete({ where: { id } });
  }

  // -- achievements -----------------------------------------------------------

  async addAchievement(
    experienceId: string,
    dto: CreateChildItemDto,
  ): Promise<ChildItemResponseDto> {
    await this.findEntity(experienceId);
    const sortOrder = dto.sortOrder ?? (await this.nextChildOrder('achievement', experienceId));

    return this.prisma.experienceAchievement.create({
      data: { experienceId, description: dto.description, sortOrder },
      select: { id: true, description: true, sortOrder: true },
    });
  }

  async removeAchievement(id: string): Promise<void> {
    const existing = await this.prisma.experienceAchievement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Achievement ${id} not found`);
    await this.prisma.experienceAchievement.delete({ where: { id } });
  }

  // -- technologies -----------------------------------------------------------

  /** Attaches by name, reusing an existing technology whenever one matches. */
  async attachTechnology(
    experienceId: string,
    dto: AttachTechnologyDto,
  ): Promise<ExperienceResponseDto> {
    await this.findEntity(experienceId);
    const technologyId = await this.technologyService.resolveByName(dto.name);

    const sortOrder =
      dto.sortOrder ?? (await this.prisma.experienceTechnology.count({ where: { experienceId } }));

    // Idempotent: re-attaching an already-linked technology updates its position instead
    // of failing on the composite primary key.
    await this.prisma.experienceTechnology.upsert({
      where: { experienceId_technologyId: { experienceId, technologyId } },
      create: { experienceId, technologyId, sortOrder },
      update: { sortOrder },
    });

    return this.findOne(experienceId);
  }

  async detachTechnology(experienceId: string, technologyId: string): Promise<void> {
    const link = await this.prisma.experienceTechnology.findUnique({
      where: { experienceId_technologyId: { experienceId, technologyId } },
    });
    if (!link) throw new NotFoundException('Technology is not attached to this experience');

    await this.prisma.experienceTechnology.delete({
      where: { experienceId_technologyId: { experienceId, technologyId } },
    });
  }

  // -- helpers ----------------------------------------------------------------

  private async findEntity(id: string): Promise<ExperienceWithRelations> {
    const entity = await this.prisma.experience.findUnique({
      where: { id },
      include: experienceInclude,
    });
    if (!entity) throw new NotFoundException(`Experience ${id} not found`);
    return entity;
  }

  private async resolveTechnologies(names?: string[]): Promise<string[]> {
    if (!names?.length) return [];

    const ids: string[] = [];
    const seen = new Set<string>();
    for (const name of names) {
      const id = await this.technologyService.resolveByName(name);
      if (!seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
    return ids;
  }

  private async nextSortOrder(personId: string): Promise<number> {
    const max = await this.prisma.experience.aggregate({
      where: { personId },
      _max: { sortOrder: true },
    });
    return (max._max.sortOrder ?? -1) + 1;
  }

  private async nextChildOrder(
    kind: 'responsibility' | 'achievement',
    experienceId: string,
  ): Promise<number> {
    const result =
      kind === 'responsibility'
        ? await this.prisma.experienceResponsibility.aggregate({
            where: { experienceId },
            _max: { sortOrder: true },
          })
        : await this.prisma.experienceAchievement.aggregate({
            where: { experienceId },
            _max: { sortOrder: true },
          });
    return (result._max.sortOrder ?? -1) + 1;
  }

  /** Continues the existing "exp<N>" sequence so new rows keep the frontend id convention. */
  private async nextLegacyId(): Promise<string> {
    const rows = await this.prisma.experience.findMany({ select: { legacyId: true } });
    const highest = rows.reduce((max, r) => {
      const n = Number(/^exp(\d+)$/.exec(r.legacyId)?.[1] ?? 0);
      return n > max ? n : max;
    }, 0);
    return `exp${highest + 1}`;
  }

  private toDto(row: ExperienceWithRelations): ExperienceResponseDto {
    return {
      id: row.id,
      legacyId: row.legacyId,
      company: row.company,
      companyFullName: row.companyFullName,
      companyLogo: row.companyLogo,
      companyWebsite: row.companyWebsite,
      companyDescription: row.companyDescription,
      position: row.position,
      location: row.location,
      startDate: row.startDate,
      endDate: row.endDate,
      isCurrent: row.isCurrent,
      description: row.description,
      responsibilities: row.responsibilities.map((r) => ({
        id: r.id,
        description: r.description,
        sortOrder: r.sortOrder,
      })),
      achievements: row.achievements.map((a) => ({
        id: a.id,
        description: a.description,
        sortOrder: a.sortOrder,
      })),
      technologies: row.technologies.map((t) => t.technology.name),
      sortOrder: row.sortOrder,
      isPublished: row.isPublished,
    };
  }
}
