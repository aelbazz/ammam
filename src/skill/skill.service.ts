import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
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
  constructor(private readonly prisma: PrismaService) {}

  async findAllCategories(
    personId: string,
    includeUnpublished = true,
  ): Promise<SkillCategoryResponseDto[]> {
    const rows = await this.prisma.skillCategory.findMany({
      where: includeUnpublished ? { personId } : { personId, isPublished: true },
      orderBy: { sortOrder: 'asc' },
      include,
    });
    return rows.map((r) => this.toDto(r));
  }

  async findCategory(personId: string, id: string): Promise<SkillCategoryResponseDto> {
    // Scoped by personId so another tenant's category is Not Found, not readable.
    const row = await this.prisma.skillCategory.findFirst({ where: { id, personId }, include });
    if (!row) throw new NotFoundException(`Skill category ${id} not found`);
    return this.toDto(row);
  }

  async createCategory(
    personId: string,
    dto: CreateSkillCategoryDto,
  ): Promise<SkillCategoryResponseDto> {
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

  async updateCategory(
    personId: string,
    id: string,
    dto: UpdateSkillCategoryDto,
  ): Promise<SkillCategoryResponseDto> {
    await this.findCategory(personId, id);
    await this.prisma.skillCategory.update({ where: { id }, data: dto });
    return this.findCategory(personId, id);
  }

  async removeCategory(personId: string, id: string): Promise<void> {
    await this.findCategory(personId, id);
    await this.prisma.skillCategory.delete({ where: { id } });
  }

  async addSkill(
    personId: string,
    categoryId: string,
    dto: CreateSkillDto,
  ): Promise<SkillResponseDto> {
    const category = await this.findCategory(personId, categoryId);
    const max = await this.prisma.skill.aggregate({
      where: { categoryId },
      _max: { sortOrder: true },
    });

    const skill = await this.prisma.skill.create({
      data: { ...dto, categoryId, sortOrder: dto.sortOrder ?? (max._max.sortOrder ?? -1) + 1 },
    });

    return { ...this.skillToDto(skill), category: category.name };
  }

  async updateSkill(personId: string, id: string, dto: UpdateSkillDto): Promise<SkillResponseDto> {
    // A skill is only reachable through a category this tenant owns.
    const existing = await this.prisma.skill.findFirst({
      where: { id, category: { personId } },
      include: { category: true },
    });
    if (!existing) throw new NotFoundException(`Skill ${id} not found`);

    const updated = await this.prisma.skill.update({ where: { id }, data: dto });
    return { ...this.skillToDto(updated), category: existing.category.name };
  }

  async removeSkill(personId: string, id: string): Promise<void> {
    const existing = await this.prisma.skill.findFirst({
      where: { id, category: { personId } },
    });
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
