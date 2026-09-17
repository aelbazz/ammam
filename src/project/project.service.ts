import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TechnologyService } from '../technology/technology.service';
import { PersonService } from '../person/person.service';
import {
  CreateProjectDto,
  ProjectHighlightResponseDto,
  ProjectResponseDto,
  UpdateProjectDto,
} from './dto/project.dto';
import { CreateChildItemDto, ReorderDto } from '../experience/dto/experience.dto';
import { AttachTechnologyDto } from '../technology/dto/technology.dto';

const byOrder = { sortOrder: 'asc' } as const;
const projectInclude = {
  highlights: { orderBy: byOrder },
  technologies: { orderBy: byOrder, include: { technology: true } },
} satisfies Prisma.ProjectInclude;

type ProjectWithRelations = Prisma.ProjectGetPayload<{ include: typeof projectInclude }>;

@Injectable()
export class ProjectService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly technologyService: TechnologyService,
    private readonly personService: PersonService,
  ) {}

  async findAll(personId: string, includeUnpublished = true): Promise<ProjectResponseDto[]> {
    const rows = await this.prisma.project.findMany({
      where: includeUnpublished ? { personId } : { personId, isPublished: true },
      orderBy: byOrder,
      include: projectInclude,
    });
    return rows.map((r) => this.toDto(r));
  }

  async findOne(personId: string, id: string): Promise<ProjectResponseDto> {
    return this.toDto(await this.findEntity(personId, id));
  }

  async create(personId: string, dto: CreateProjectDto): Promise<ProjectResponseDto> {
    const { highlights, technologies, legacyId, sortOrder, ...rest } = dto;
    const technologyIds = await this.resolveTechnologies(personId, technologies);

    const created = await this.prisma.project.create({
      data: {
        ...rest,
        personId,
        legacyId: legacyId ?? (await this.nextLegacyId(personId)),
        sortOrder: sortOrder ?? (await this.nextSortOrder(personId)),
        highlights: {
          create: (highlights ?? []).map((description, i) => ({ description, sortOrder: i })),
        },
        technologies: {
          create: technologyIds.map((technologyId, i) => ({ technologyId, sortOrder: i })),
        },
      },
      include: projectInclude,
    });

    return this.toDto(created);
  }

  async update(personId: string, id: string, dto: UpdateProjectDto): Promise<ProjectResponseDto> {
    await this.findEntity(personId, id);
    const { highlights, technologies, ...rest } = dto;
    const technologyIds = technologies
      ? await this.resolveTechnologies(personId, technologies)
      : undefined;

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.project.update({ where: { id }, data: rest });

      // Omitted arrays are left alone; an explicit [] clears the collection.
      if (highlights) {
        await tx.projectHighlight.deleteMany({ where: { projectId: id } });
        await tx.projectHighlight.createMany({
          data: highlights.map((description, i) => ({ projectId: id, description, sortOrder: i })),
        });
      }

      if (technologyIds) {
        await tx.projectTechnology.deleteMany({ where: { projectId: id } });
        await tx.projectTechnology.createMany({
          data: technologyIds.map((technologyId, i) => ({
            projectId: id,
            technologyId,
            sortOrder: i,
          })),
        });
      }

      return tx.project.findUniqueOrThrow({ where: { id }, include: projectInclude });
    });

    return this.toDto(updated);
  }

  async remove(personId: string, id: string): Promise<void> {
    await this.findEntity(personId, id);
    await this.prisma.project.delete({ where: { id } });
  }

  async reorder(personId: string, dto: ReorderDto): Promise<void> {
    // updateMany with personId in the filter: an id from another tenant matches nothing.
    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.project.updateMany({
          where: { id: item.id, personId },
          data: { sortOrder: item.sortOrder },
        }),
      ),
    );
  }

  async addHighlight(
    personId: string,
    projectId: string,
    dto: CreateChildItemDto,
  ): Promise<ProjectHighlightResponseDto> {
    await this.findEntity(personId, projectId);
    const max = await this.prisma.projectHighlight.aggregate({
      where: { projectId },
      _max: { sortOrder: true },
    });

    return this.prisma.projectHighlight.create({
      data: {
        projectId,
        description: dto.description,
        sortOrder: dto.sortOrder ?? (max._max.sortOrder ?? -1) + 1,
      },
      select: { id: true, description: true, sortOrder: true },
    });
  }

  async removeHighlight(personId: string, id: string): Promise<void> {
    // A child id is only reachable through a parent this tenant owns.
    const existing = await this.prisma.projectHighlight.findFirst({
      where: { id, project: { personId } },
    });
    if (!existing) throw new NotFoundException(`Highlight ${id} not found`);
    await this.prisma.projectHighlight.delete({ where: { id } });
  }

  async attachTechnology(
    personId: string,
    projectId: string,
    dto: AttachTechnologyDto,
  ): Promise<ProjectResponseDto> {
    await this.findEntity(personId, projectId);
    const technologyId = await this.technologyService.resolveByName(personId, dto.name);
    const sortOrder =
      dto.sortOrder ?? (await this.prisma.projectTechnology.count({ where: { projectId } }));

    await this.prisma.projectTechnology.upsert({
      where: { projectId_technologyId: { projectId, technologyId } },
      create: { projectId, technologyId, sortOrder },
      update: { sortOrder },
    });

    return this.findOne(personId, projectId);
  }

  async detachTechnology(personId: string, projectId: string, technologyId: string): Promise<void> {
    // Confirms the project is this tenant's before touching the junction row.
    await this.findEntity(personId, projectId);

    const link = await this.prisma.projectTechnology.findUnique({
      where: { projectId_technologyId: { projectId, technologyId } },
    });
    if (!link) throw new NotFoundException('Technology is not attached to this project');

    await this.prisma.projectTechnology.delete({
      where: { projectId_technologyId: { projectId, technologyId } },
    });
  }

  /**
   * Single gate for every by-id operation. Scoping the lookup by personId is what stops
   * one tenant reading or editing another's project by guessing an id.
   */
  private async findEntity(personId: string, id: string): Promise<ProjectWithRelations> {
    const entity = await this.prisma.project.findFirst({
      where: { id, personId },
      include: projectInclude,
    });
    if (!entity) throw new NotFoundException(`Project ${id} not found`);
    return entity;
  }

  private async resolveTechnologies(personId: string, names?: string[]): Promise<string[]> {
    if (!names?.length) return [];
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const name of names) {
      const id = await this.technologyService.resolveByName(personId, name);
      if (!seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
    return ids;
  }

  private async nextSortOrder(personId: string): Promise<number> {
    const max = await this.prisma.project.aggregate({
      where: { personId },
      _max: { sortOrder: true },
    });
    return (max._max.sortOrder ?? -1) + 1;
  }

  /** Continues this tenant's own "exp<N>" / "proj<N>" sequence. */
  private async nextLegacyId(personId: string): Promise<string> {
    const rows = await this.prisma.project.findMany({
      where: { personId },
      select: { legacyId: true },
    });
    const highest = rows.reduce((max, r) => {
      const n = Number(/^proj(\d+)$/.exec(r.legacyId)?.[1] ?? 0);
      return n > max ? n : max;
    }, 0);
    return `proj${highest + 1}`;
  }

  private toDto(row: ProjectWithRelations): ProjectResponseDto {
    return {
      id: row.id,
      legacyId: row.legacyId,
      name: row.name,
      description: row.description,
      role: row.role,
      startDate: row.startDate,
      endDate: row.endDate,
      type: row.type,
      company: row.company,
      highlights: row.highlights.map((h) => ({
        id: h.id,
        description: h.description,
        sortOrder: h.sortOrder,
      })),
      technologies: row.technologies.map((t) => t.technology.name),
      imageUrl: row.imageUrl,
      githubUrl: row.githubUrl,
      liveUrl: row.liveUrl,
      isStrategicInitiative: row.isStrategicInitiative,
      isCurrent: row.isCurrent,
      sortOrder: row.sortOrder,
      isPublished: row.isPublished,
    };
  }
}
