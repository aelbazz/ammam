import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateTechnologyDto,
  TechnologyResponseDto,
  UpdateTechnologyDto,
} from './dto/technology.dto';

/**
 * Normalised matching key. Must stay identical to `technologySlug` in prisma/seed.ts -
 * it is what guarantees "Node.js", "NodeJS" and "node js" resolve to a single row.
 */
export function technologySlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Technologies are reusable within one tenant and invisible to every other tenant.
 * Uniqueness is (personId, slug), so two profiles can each own an "Angular" without one
 * being able to rename or delete the other's.
 */
@Injectable()
export class TechnologyService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(personId: string): Promise<TechnologyResponseDto[]> {
    const rows = await this.prisma.technology.findMany({
      where: { personId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { experiences: true, projects: true } } },
    });

    return rows.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      experienceCount: t._count.experiences,
      projectCount: t._count.projects,
    }));
  }

  async findOne(personId: string, id: string): Promise<TechnologyResponseDto> {
    // findFirst with personId, not findUnique by id: another tenant's technology must be
    // Not Found rather than readable.
    const tech = await this.prisma.technology.findFirst({
      where: { id, personId },
      include: { _count: { select: { experiences: true, projects: true } } },
    });

    if (!tech) throw new NotFoundException(`Technology ${id} not found`);

    return {
      id: tech.id,
      name: tech.name,
      slug: tech.slug,
      experienceCount: tech._count.experiences,
      projectCount: tech._count.projects,
    };
  }

  async create(personId: string, dto: CreateTechnologyDto): Promise<TechnologyResponseDto> {
    const name = dto.name.trim();
    const slug = technologySlug(name);

    // Upsert rather than create: "create Angular" when this tenant already has Angular
    // returns the existing row instead of failing or duplicating.
    const tech = await this.prisma.technology.upsert({
      where: { personId_slug: { personId, slug } },
      create: { personId, name, slug },
      update: {},
    });

    return { id: tech.id, name: tech.name, slug: tech.slug };
  }

  async update(
    personId: string,
    id: string,
    dto: UpdateTechnologyDto,
  ): Promise<TechnologyResponseDto> {
    await this.findOne(personId, id);

    const data = dto.name ? { name: dto.name.trim(), slug: technologySlug(dto.name) } : {};
    const tech = await this.prisma.technology.update({ where: { id }, data });

    return { id: tech.id, name: tech.name, slug: tech.slug };
  }

  /** Cascades to the junction rows, detaching it from this tenant's experiences/projects. */
  async remove(personId: string, id: string): Promise<void> {
    await this.findOne(personId, id);
    await this.prisma.technology.delete({ where: { id } });
  }

  /**
   * Resolves a technology name to an id within one tenant, creating it only when nothing
   * matches its normalised slug. Shared by the experience and project attach endpoints.
   */
  async resolveByName(personId: string, name: string): Promise<string> {
    const trimmed = name.trim();
    const slug = technologySlug(trimmed);

    const tech = await this.prisma.technology.upsert({
      where: { personId_slug: { personId, slug } },
      create: { personId, name: trimmed, slug },
      update: {},
      select: { id: true },
    });

    return tech.id;
  }
}
