import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ThemeResponseDto, UpdateThemeDto } from './dto/theme.dto';

/**
 * One row per tenant, created with defaults during onboarding (TenantService.create) - so
 * `findOne` never needs to create one on the fly, and a missing row is a genuine data
 * problem rather than "not configured yet".
 */
@Injectable()
export class ThemeService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(tenantId: string): Promise<ThemeResponseDto> {
    const theme = await this.prisma.tenantTheme.findUnique({ where: { tenantId } });
    if (!theme) throw new NotFoundException('Theme not found for this tenant');
    return theme;
  }

  async update(tenantId: string, dto: UpdateThemeDto): Promise<ThemeResponseDto> {
    await this.findOne(tenantId);
    return this.prisma.tenantTheme.update({ where: { tenantId }, data: dto });
  }
}
