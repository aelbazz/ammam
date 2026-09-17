import { Injectable, NotFoundException } from '@nestjs/common';
import { Achievement } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PersonService } from '../person/person.service';
import {
  AchievementResponseDto,
  CreateAchievementDto,
  UpdateAchievementDto,
} from './dto/achievement.dto';
import { ReorderDto } from '../experience/dto/experience.dto';

@Injectable()
export class AchievementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly personService: PersonService,
  ) {}

  async findAll(personId: string, includeUnpublished = true): Promise<AchievementResponseDto[]> {
    const rows = await this.prisma.achievement.findMany({
      where: includeUnpublished ? { personId } : { personId, isPublished: true },
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map((r) => this.toDto(r));
  }

  async findOne(personId: string, id: string): Promise<AchievementResponseDto> {
    // findFirst with personId, not findUnique by id: another tenant's id must resolve to
    // nothing rather than returning their record.
    const row = await this.prisma.achievement.findFirst({ where: { id, personId } });
    if (!row) throw new NotFoundException(`Achievement ${id} not found`);
    return this.toDto(row);
  }

  async create(personId: string, dto: CreateAchievementDto): Promise<AchievementResponseDto> {
    const { legacyId, sortOrder, ...rest } = dto;

    const max = await this.prisma.achievement.aggregate({
      where: { personId },
      _max: { sortOrder: true },
    });
    const created = await this.prisma.achievement.create({
      data: {
        ...rest,
        personId,
        legacyId: legacyId ?? (await this.nextLegacyId(personId)),
        sortOrder: sortOrder ?? (max._max.sortOrder ?? -1) + 1,
      },
    });
    return this.toDto(created);
  }

  async update(
    personId: string,
    id: string,
    dto: UpdateAchievementDto,
  ): Promise<AchievementResponseDto> {
    await this.findOne(personId, id);
    return this.toDto(await this.prisma.achievement.update({ where: { id }, data: dto }));
  }

  async remove(personId: string, id: string): Promise<void> {
    await this.findOne(personId, id);
    await this.prisma.achievement.delete({ where: { id } });
  }

  async reorder(personId: string, dto: ReorderDto): Promise<void> {
    await this.prisma.$transaction(
      // Scoped by personId, so an id from another tenant matches nothing.
      dto.items.map((i) =>
        this.prisma.achievement.updateMany({
          where: { id: i.id, personId },
          data: { sortOrder: i.sortOrder },
        }),
      ),
    );
  }

  /** Continues this tenant's own legacy-id sequence, not the global one. */
  private async nextLegacyId(personId: string): Promise<string> {
    const rows = await this.prisma.achievement.findMany({
      where: { personId },
      select: { legacyId: true },
    });
    const highest = rows.reduce((max, r) => {
      const n = Number(/^ach(\d+)$/.exec(r.legacyId)?.[1] ?? 0);
      return n > max ? n : max;
    }, 0);
    return `ach${highest + 1}`;
  }

  private toDto(row: Achievement): AchievementResponseDto {
    return {
      id: row.id,
      legacyId: row.legacyId,
      title: row.title,
      description: row.description,
      date: row.date,
      category: row.category,
      organization: row.organization,
      icon: row.icon,
      articleUrl: row.articleUrl,
      sortOrder: row.sortOrder,
      isPublished: row.isPublished,
    };
  }
}
