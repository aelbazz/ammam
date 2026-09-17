import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ContactResponseDto,
  SocialLinkDto,
  UpdateContactDto,
  UpsertContactDto,
} from './dto/contact.dto';

const include = { socialLinks: { orderBy: { sortOrder: 'asc' } } } satisfies Prisma.ContactInclude;
type ContactWithLinks = Prisma.ContactGetPayload<{ include: typeof include }>;

/** Contact is 1:1 with person, so it is addressed without an id, like person. */
@Injectable()
export class ContactService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(personId: string): Promise<ContactResponseDto> {
    const contact = await this.prisma.contact.findUnique({ where: { personId }, include });
    if (!contact) throw new NotFoundException('Contact information not found');
    return this.toDto(contact);
  }

  /** Creates the contact row if it does not exist yet, otherwise replaces its fields. */
  async upsert(personId: string, dto: UpsertContactDto): Promise<ContactResponseDto> {
    const { socialLinks, ...rest } = dto;

    const contact = await this.prisma.contact.upsert({
      where: { personId },
      create: { personId, ...rest },
      update: rest,
      include,
    });

    if (socialLinks) await this.replaceSocialLinks(contact.id, socialLinks);

    return this.findOne(personId);
  }

  async update(personId: string, dto: UpdateContactDto): Promise<ContactResponseDto> {
    const existing = await this.prisma.contact.findUnique({ where: { personId } });
    if (!existing) throw new NotFoundException('Contact information not found');

    const { socialLinks, ...rest } = dto;
    await this.prisma.contact.update({ where: { personId }, data: rest });

    // Only replace links when the caller actually sent the field.
    if (socialLinks) await this.replaceSocialLinks(existing.id, socialLinks);

    return this.findOne(personId);
  }

  private async replaceSocialLinks(contactId: string, links: SocialLinkDto[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.contactSocialLink.deleteMany({ where: { contactId } }),
      this.prisma.contactSocialLink.createMany({
        data: links.map((link, i) => ({
          contactId,
          platform: link.platform,
          url: link.url,
          icon: link.icon ?? null,
          sortOrder: link.sortOrder ?? i,
        })),
      }),
    ]);
  }

  private toDto(contact: ContactWithLinks): ContactResponseDto {
    return {
      id: contact.id,
      email: contact.email,
      phone: contact.phone,
      whatsapp: contact.whatsapp,
      linkedin: contact.linkedin,
      location: contact.location,
      birthday: contact.birthday,
      muchskills: contact.muchskills,
      socialLinks: contact.socialLinks.map((l) => ({
        id: l.id,
        platform: l.platform,
        url: l.url,
        icon: l.icon,
        sortOrder: l.sortOrder,
      })),
    };
  }
}
