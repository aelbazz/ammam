import { Injectable, NotFoundException } from '@nestjs/common';
import { TimelineEvent } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PersonService } from '../person/person.service';
import {
  CreateTimelineEventDto,
  TimelineEventResponseDto,
  UpdateTimelineEventDto,
} from './dto/timeline-event.dto';
import { ReorderDto } from '../experience/dto/experience.dto';

@Injectable()
export class TimelineEventService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly personService: PersonService,
  ) {}

  /** Ordered by sortOrder, which carries the chronological order authored in the source data. */
  async findAll(includeUnpublished = true): Promise<TimelineEventResponseDto[]> {
    const rows = await this.prisma.timelineEvent.findMany({
      where: includeUnpublished ? {} : { isPublished: true },
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map((r) => this.toDto(r));
  }

  async findOne(id: string): Promise<TimelineEventResponseDto> {
    const row = await this.prisma.timelineEvent.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Timeline event ${id} not found`);
    return this.toDto(row);
  }

  async create(dto: CreateTimelineEventDto): Promise<TimelineEventResponseDto> {
    const personId = await this.personService.getDefaultPersonId();
    const { legacyId, sortOrder, ...rest } = dto;
    const max = await this.prisma.timelineEvent.aggregate({
      where: { personId },
      _max: { sortOrder: true },
    });

    return this.toDto(
      await this.prisma.timelineEvent.create({
        data: {
          ...rest,
          personId,
          legacyId: legacyId ?? (await this.nextLegacyId()),
          sortOrder: sortOrder ?? (max._max.sortOrder ?? -1) + 1,
        },
      }),
    );
  }

  async update(id: string, dto: UpdateTimelineEventDto): Promise<TimelineEventResponseDto> {
    await this.findOne(id);
    return this.toDto(await this.prisma.timelineEvent.update({ where: { id }, data: dto }));
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.timelineEvent.delete({ where: { id } });
  }

  async reorder(dto: ReorderDto): Promise<void> {
    await this.prisma.$transaction(
      dto.items.map((i) =>
        this.prisma.timelineEvent.update({ where: { id: i.id }, data: { sortOrder: i.sortOrder } }),
      ),
    );
  }

  private async nextLegacyId(): Promise<string> {
    const rows = await this.prisma.timelineEvent.findMany({ select: { legacyId: true } });
    const highest = rows.reduce((max, r) => {
      const n = Number(/^evt(\d+)$/.exec(r.legacyId)?.[1] ?? 0);
      return n > max ? n : max;
    }, 0);
    return `evt${highest + 1}`;
  }

  private toDto(row: TimelineEvent): TimelineEventResponseDto {
    return {
      id: row.id,
      legacyId: row.legacyId,
      date: row.date,
      title: row.title,
      subtitle: row.subtitle,
      description: row.description,
      type: row.type,
      icon: row.icon,
      sortOrder: row.sortOrder,
      isPublished: row.isPublished,
    };
  }
}
