import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ThemeResponseDto, UpdateThemeDto } from './dto/theme.dto';
import { isCompatible, isValidDesignSystem, isValidLayout } from './design-registry';
import { isValidThemeMode } from './theme-mode-registry';

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
    const existing = await this.findOne(tenantId);

    if (dto.designSystem && !isValidDesignSystem(dto.designSystem)) {
      throw new BadRequestException(`Unknown design system "${dto.designSystem}"`);
    }
    if (dto.layout && !isValidLayout(dto.layout)) {
      throw new BadRequestException(`Unknown layout "${dto.layout}"`);
    }
    if (dto.themeMode && !isValidThemeMode(dto.themeMode)) {
      throw new BadRequestException(`Unknown theme mode "${dto.themeMode}"`);
    }

    const nextDesignSystem = dto.designSystem ?? existing.designSystem;
    const nextLayout = dto.layout ?? existing.layout;

    if ((dto.designSystem || dto.layout) && !isCompatible(nextDesignSystem, nextLayout)) {
      throw new BadRequestException(
        `Layout "${nextLayout}" is not supported by design system "${nextDesignSystem}"`,
      );
    }

    return this.prisma.tenantTheme.update({ where: { tenantId }, data: dto });
  }
}
