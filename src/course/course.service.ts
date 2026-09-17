import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PersonService } from '../person/person.service';
import { CourseResponseDto, CreateCourseDto, UpdateCourseDto } from './dto/course.dto';
import { ReorderDto } from '../experience/dto/experience.dto';

const include = { skills: { orderBy: { sortOrder: 'asc' } } } satisfies Prisma.CourseInclude;
type CourseWithSkills = Prisma.CourseGetPayload<{ include: typeof include }>;

@Injectable()
export class CourseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly personService: PersonService,
  ) {}

  async findAll(personId: string, includeUnpublished = true): Promise<CourseResponseDto[]> {
    const rows = await this.prisma.course.findMany({
      where: includeUnpublished ? { personId } : { personId, isPublished: true },
      orderBy: { sortOrder: 'asc' },
      include,
    });
    return rows.map((r) => this.toDto(r));
  }

  async findOne(personId: string, id: string): Promise<CourseResponseDto> {
    // Scoped by personId so a cross-tenant id is Not Found, not a data leak.
    const row = await this.prisma.course.findFirst({ where: { id, personId }, include });
    if (!row) throw new NotFoundException(`Course ${id} not found`);
    return this.toDto(row);
  }

  async create(personId: string, dto: CreateCourseDto): Promise<CourseResponseDto> {
    const { skills, legacyId, sortOrder, ...rest } = dto;
    const max = await this.prisma.course.aggregate({
      where: { personId },
      _max: { sortOrder: true },
    });

    const created = await this.prisma.course.create({
      data: {
        ...rest,
        personId,
        legacyId: legacyId ?? (await this.nextLegacyId(personId)),
        sortOrder: sortOrder ?? (max._max.sortOrder ?? -1) + 1,
        skills: { create: (skills ?? []).map((name, i) => ({ name, sortOrder: i })) },
      },
      include,
    });
    return this.toDto(created);
  }

  async update(personId: string, id: string, dto: UpdateCourseDto): Promise<CourseResponseDto> {
    await this.findOne(personId, id);
    const { skills, ...rest } = dto;

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.course.update({ where: { id }, data: rest });

      // Omitted leaves skills untouched; an explicit [] clears them.
      if (skills) {
        await tx.courseSkill.deleteMany({ where: { courseId: id } });
        await tx.courseSkill.createMany({
          data: skills.map((name, i) => ({ courseId: id, name, sortOrder: i })),
        });
      }

      return tx.course.findUniqueOrThrow({ where: { id }, include });
    });

    return this.toDto(updated);
  }

  async remove(personId: string, id: string): Promise<void> {
    await this.findOne(personId, id);
    await this.prisma.course.delete({ where: { id } });
  }

  async reorder(personId: string, dto: ReorderDto): Promise<void> {
    await this.prisma.$transaction(
      // Scoped by personId, so an id from another tenant matches nothing.
      dto.items.map((i) =>
        this.prisma.course.updateMany({
          where: { id: i.id, personId },
          data: { sortOrder: i.sortOrder },
        }),
      ),
    );
  }

  /** Continues this tenant's own legacy-id sequence, not the global one. */
  private async nextLegacyId(personId: string): Promise<string> {
    const rows = await this.prisma.course.findMany({
      where: { personId },
      select: { legacyId: true },
    });
    const highest = rows.reduce((max, r) => {
      const n = Number(/^edu(\d+)$/.exec(r.legacyId)?.[1] ?? 0);
      return n > max ? n : max;
    }, 0);
    return `edu${highest + 1}`;
  }

  private toDto(row: CourseWithSkills): CourseResponseDto {
    return {
      id: row.id,
      legacyId: row.legacyId,
      title: row.title,
      provider: row.provider,
      completionDate: row.completionDate,
      level: row.level,
      description: row.description,
      skills: row.skills.map((s) => s.name),
      duration: row.duration,
      instructor: row.instructor,
      courseUrl: row.courseUrl,
      certificateUrl: row.certificateUrl,
      startDate: row.startDate,
      grade: row.grade,
      sortOrder: row.sortOrder,
      isPublished: row.isPublished,
    };
  }
}
