import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PersonResponseDto, UpdatePersonDto } from './dto/person.dto';

/**
 * The profile content owned by one tenant. Every method here takes the caller's own
 * personId, resolved from the database during JWT validation - never from a route
 * parameter or request body, so a CLIENT cannot name a profile they do not own.
 *
 * Tenant-level concerns (slug, status, subscription) live on Tenant / Subscription and are
 * exposed by GET /tenant/me, not here - this stays exactly what it was before the SaaS
 * pivot: the profile fields alone.
 */
@Injectable()
export class PersonService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(personId: string): Promise<PersonResponseDto> {
    const person = await this.prisma.person.findUnique({ where: { id: personId } });
    if (!person) throw new NotFoundException('Profile not found');

    return {
      id: person.id,
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
}
