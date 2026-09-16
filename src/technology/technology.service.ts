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

@Injectable()
export class TechnologyService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<TechnologyResponseDto[]> {
    const rows = await this.prisma.technology.findMany({
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

  async findOne(id: string): Promise<TechnologyResponseDto> {
    const tech = await this.prisma.technology.findUnique({
      where: { id },
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

  async create(dto: CreateTechnologyDto): Promise<TechnologyResponseDto> {
    const name = dto.name.trim();
    const slug = technologySlug(name);

    // Upsert rather than create: "create Angular" when Angular already exists returns the
    // existing row instead of failing or duplicating.
    const tech = await this.prisma.technology.upsert({
      where: { slug },
      create: { name, slug },
      update: {},
    });

    return { id: tech.id, name: tech.name, slug: tech.slug };
  }

  async update(id: string, dto: UpdateTechnologyDto): Promise<TechnologyResponseDto> {
    await this.findOne(id);

    const data = dto.name ? { name: dto.name.trim(), slug: technologySlug(dto.name) } : {};
    const tech = await this.prisma.technology.update({ where: { id }, data });

    return { id: tech.id, name: tech.name, slug: tech.slug };
  }

  /** Cascades to the junction rows, detaching the technology from every experience/project. */
  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.technology.delete({ where: { id } });
  }

  /**
   * Resolves a technology name to an id, creating the technology only when nothing matches
   * its normalised slug. Shared by the experience and project attach endpoints.
   */
  async resolveByName(name: string): Promise<string> {
    const trimmed = name.trim();
    const slug = technologySlug(trimmed);

    const tech = await this.prisma.technology.upsert({
      where: { slug },
      create: { name: trimmed, slug },
      update: {},
      select: { id: true },
    });

    return tech.id;
  }
}
