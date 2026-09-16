import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PersonService } from '../person/person.service';
import {
  CreateManagementRoleDto,
  ManagementRoleResponseDto,
  UpdateManagementRoleDto,
} from './dto/management-role.dto';
import { ReorderDto } from '../experience/dto/experience.dto';

const byOrder = { sortOrder: 'asc' } as const;
const include = {
  keyResponsibilities: { orderBy: byOrder },
  achievements: { orderBy: byOrder },
} satisfies Prisma.ManagementRoleInclude;

type RoleWithChildren = Prisma.ManagementRoleGetPayload<{ include: typeof include }>;

/** Management roles are a separate domain concept from Experience and are never merged. */
@Injectable()
export class ManagementRoleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly personService: PersonService,
  ) {}

  async findAll(includeUnpublished = true): Promise<ManagementRoleResponseDto[]> {
    const rows = await this.prisma.managementRole.findMany({
      where: includeUnpublished ? {} : { isPublished: true },
      orderBy: byOrder,
      include,
    });
    return rows.map((r) => this.toDto(r));
  }

  async findOne(id: string): Promise<ManagementRoleResponseDto> {
    const row = await this.prisma.managementRole.findUnique({ where: { id }, include });
    if (!row) throw new NotFoundException(`Management role ${id} not found`);
    return this.toDto(row);
  }

  async create(dto: CreateManagementRoleDto): Promise<ManagementRoleResponseDto> {
    const personId = await this.personService.getDefaultPersonId();
    const { keyResponsibilities, achievements, legacyId, sortOrder, ...rest } = dto;
    const max = await this.prisma.managementRole.aggregate({
      where: { personId },
      _max: { sortOrder: true },
    });

    const created = await this.prisma.managementRole.create({
      data: {
        ...rest,
        personId,
        legacyId: legacyId ?? (await this.nextLegacyId()),
        sortOrder: sortOrder ?? (max._max.sortOrder ?? -1) + 1,
        keyResponsibilities: {
          create: (keyResponsibilities ?? []).map((description, i) => ({
            description,
            sortOrder: i,
          })),
        },
        achievements: {
          create: (achievements ?? []).map((description, i) => ({ description, sortOrder: i })),
        },
      },
      include,
    });
    return this.toDto(created);
  }

  async update(id: string, dto: UpdateManagementRoleDto): Promise<ManagementRoleResponseDto> {
    await this.findOne(id);
    const { keyResponsibilities, achievements, ...rest } = dto;

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.managementRole.update({ where: { id }, data: rest });

      if (keyResponsibilities) {
        await tx.managementResponsibilityItem.deleteMany({ where: { managementRoleId: id } });
        await tx.managementResponsibilityItem.createMany({
          data: keyResponsibilities.map((description, i) => ({
            managementRoleId: id,
            description,
            sortOrder: i,
          })),
        });
      }

      if (achievements) {
        await tx.managementAchievement.deleteMany({ where: { managementRoleId: id } });
        await tx.managementAchievement.createMany({
          data: achievements.map((description, i) => ({
            managementRoleId: id,
            description,
            sortOrder: i,
          })),
        });
      }

      return tx.managementRole.findUniqueOrThrow({ where: { id }, include });
    });

    return this.toDto(updated);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.managementRole.delete({ where: { id } });
  }

  async reorder(dto: ReorderDto): Promise<void> {
    await this.prisma.$transaction(
      dto.items.map((i) =>
        this.prisma.managementRole.update({
          where: { id: i.id },
          data: { sortOrder: i.sortOrder },
        }),
      ),
    );
  }

  private async nextLegacyId(): Promise<string> {
    const rows = await this.prisma.managementRole.findMany({ select: { legacyId: true } });
    const highest = rows.reduce((max, r) => {
      const n = Number(/^mgmt(\d+)$/.exec(r.legacyId)?.[1] ?? 0);
      return n > max ? n : max;
    }, 0);
    return `mgmt${highest + 1}`;
  }

  private toDto(row: RoleWithChildren): ManagementRoleResponseDto {
    return {
      id: row.id,
      legacyId: row.legacyId,
      level: row.level,
      title: row.title,
      organization: row.organization,
      startDate: row.startDate,
      endDate: row.endDate,
      isCurrent: row.isCurrent,
      description: row.description,
      teamSize: row.teamSize,
      keyResponsibilities: row.keyResponsibilities.map((r) => ({
        id: r.id,
        description: r.description,
        sortOrder: r.sortOrder,
      })),
      achievements: row.achievements.map((a) => ({
        id: a.id,
        description: a.description,
        sortOrder: a.sortOrder,
      })),
      sortOrder: row.sortOrder,
      isPublished: row.isPublished,
    };
  }
}
