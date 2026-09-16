import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PersonService } from '../person/person.service';
import {
  CreateSkillCategoryDto,
  CreateSkillDto,
  SkillCategoryResponseDto,
  SkillResponseDto,
  UpdateSkillCategoryDto,
  UpdateSkillDto,
} from './dto/skill.dto';

const include = { skills: { orderBy: { sortOrder: 'asc' } } } satisfies Prisma.SkillCategoryInclude;
type CategoryWithSkills = Prisma.SkillCategoryGetPayload<{ include: typeof include }>;

@Injectable()
export class SkillService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly personService: PersonService,
  ) {}

  async findAllCategories(includeUnpublished = true): Promise<SkillCategoryResponseDto[]> {
    const rows = await this.prisma.skillCategory.findMany({
      where: includeUnpublished ? {} : { isPublished: true },
      orderBy: { sortOrder: 'asc' },
      include,
    });
    return rows.map((r) => this.toDto(r));
  }

  async findCategory(id: string): Promise<SkillCategoryResponseDto> {
    const row = await this.prisma.skillCategory.findUnique({ where: { id }, include });
    if (!row) throw new NotFoundException(`Skill category ${id} not found`);
    return this.toDto(row);
  }

  async createCategory(dto: CreateSkillCategoryDto): Promise<SkillCategoryResponseDto> {
    const personId = await this.personService.getDefaultPersonId();
    const max = await this.prisma.skillCategory.aggregate({
      where: { personId },
      _max: { sortOrder: true },
    });

    const created = await this.prisma.skillCategory.create({
      data: {
        personId,
        name: dto.name,
        isPublished: dto.isPublished ?? true,
        sortOrder: dto.sortOrder ?? (max._max.sortOrder ?? -1) + 1,
      },
      include,
    });
    return this.toDto(created);
  }

  async updateCategory(id: string, dto: UpdateSkillCategoryDto): Promise<SkillCategoryResponseDto> {
    await this.findCategory(id);
    await this.prisma.skillCategory.update({ where: { id }, data: dto });
    return this.findCategory(id);
  }

  async removeCategory(id: string): Promise<void> {
    await this.findCategory(id);
    await this.prisma.skillCategory.delete({ where: { id } });
  }

  async addSkill(categoryId: string, dto: CreateSkillDto): Promise<SkillResponseDto> {
    const category = await this.findCategory(categoryId);
    const max = await this.prisma.skill.aggregate({
      where: { categoryId },
      _max: { sortOrder: true },
    });

    const skill = await this.prisma.skill.create({
      data: { ...dto, categoryId, sortOrder: dto.sortOrder ?? (max._max.sortOrder ?? -1) + 1 },
    });

    return { ...this.skillToDto(skill), category: category.name };
  }

  async updateSkill(id: string, dto: UpdateSkillDto): Promise<SkillResponseDto> {
    const existing = await this.prisma.skill.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!existing) throw new NotFoundException(`Skill ${id} not found`);

    const updated = await this.prisma.skill.update({ where: { id }, data: dto });
    return { ...this.skillToDto(updated), category: existing.category.name };
  }

  async removeSkill(id: string): Promise<void> {
    const existing = await this.prisma.skill.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Skill ${id} not found`);
    await this.prisma.skill.delete({ where: { id } });
  }

  private skillToDto(s: Prisma.SkillGetPayload<object>): Omit<SkillResponseDto, 'category'> {
    return {
      id: s.id,
      name: s.name,
      level: s.level,
      since: s.since,
      icon: s.icon,
      yearsOfExperience: s.yearsOfExperience,
      endorsements: s.endorsements,
      sortOrder: s.sortOrder,
    };
  }

  private toDto(row: CategoryWithSkills): SkillCategoryResponseDto {
    return {
      id: row.id,
      name: row.name,
      // `category` is denormalised onto each skill to match the frontend Skill interface.
      skills: row.skills.map((s) => ({ ...this.skillToDto(s), category: row.name })),
      sortOrder: row.sortOrder,
      isPublished: row.isPublished,
    };
  }
}
