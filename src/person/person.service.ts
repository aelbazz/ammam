import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PersonResponseDto, UpdatePersonDto } from './dto/person.dto';

export const DEFAULT_PERSON_SLUG = 'default';

/**
 * Person is a singleton for this application. The slug makes it addressable and leaves the
 * door open to multiple profiles later, without adding tenancy plumbing now.
 */
@Injectable()
export class PersonService {
  constructor(private readonly prisma: PrismaService) {}

  async getDefaultPersonId(): Promise<string> {
    const person = await this.prisma.person.findUnique({
      where: { slug: DEFAULT_PERSON_SLUG },
      select: { id: true },
    });

    if (!person) {
      throw new NotFoundException('No profile exists. Run the seed/import first.');
    }
    return person.id;
  }

  async findOne(): Promise<PersonResponseDto> {
    const person = await this.prisma.person.findUnique({ where: { slug: DEFAULT_PERSON_SLUG } });
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

  async update(dto: UpdatePersonDto): Promise<PersonResponseDto> {
    const id = await this.getDefaultPersonId();
    await this.prisma.person.update({ where: { id }, data: dto });
    return this.findOne();
  }
}
