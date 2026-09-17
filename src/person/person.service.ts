import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PersonResponseDto, UpdatePersonDto } from './dto/person.dto';

/**
 * A Person is a tenant. Every method here takes the caller's own personId, resolved from
 * the database during JWT validation - never from a route parameter or request body, so an
 * administrator cannot name a tenant they do not belong to.
 */
@Injectable()
export class PersonService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(personId: string): Promise<PersonResponseDto> {
    const person = await this.prisma.person.findUnique({ where: { id: personId } });
    if (!person) throw new NotFoundException('Profile not found');

    return {
      id: person.id,
      slug: person.slug,
      name: person.name,
      title: person.title,
      summary: person.summary,
      location: person.location,
      yearsOfExperience: person.yearsOfExperience,
      avatar: person.avatar,
      tagline: person.tagline,
      linkedin: person.linkedin,
      birthday: person.birthday,
    };
  }

  async update(personId: string, dto: UpdatePersonDto): Promise<PersonResponseDto> {
    await this.findOne(personId);
    await this.prisma.person.update({ where: { id: personId }, data: dto });
    return this.findOne(personId);
  }

  /** Resolves a tenant by its public slug, for the anonymous profile endpoint. */
  async findIdBySlug(slug: string): Promise<string> {
    const person = await this.prisma.person.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!person) throw new NotFoundException(`No profile exists at "${slug}"`);
    return person.id;
  }
}
