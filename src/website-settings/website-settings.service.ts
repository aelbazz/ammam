import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateWebsiteSettingsDto, WebsiteSettingsResponseDto } from './dto/website-settings.dto';

@Injectable()
export class WebsiteSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(tenantId: string): Promise<WebsiteSettingsResponseDto> {
    const settings = await this.prisma.websiteSettings.findUnique({ where: { tenantId } });
    if (!settings) throw new NotFoundException('Website settings not found for this tenant');
    return settings;
  }

  async update(
    tenantId: string,
    dto: UpdateWebsiteSettingsDto,
  ): Promise<WebsiteSettingsResponseDto> {
    await this.findOne(tenantId);
    return this.prisma.websiteSettings.update({ where: { tenantId }, data: dto });
  }
}
