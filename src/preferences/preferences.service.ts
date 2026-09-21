import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { isValidThemeMode } from '../theme/theme-mode-registry';
import { PreferencesResponseDto } from './dto/preferences.dto';

const DEFAULT_THEME_MODE = 'light';

/**
 * The Control Portal's own theme preference - independent of TenantTheme, which is the
 * PUBLIC WEBSITE's theme. Keyed by userId, so it works identically for CLIENT, COORDINATOR
 * and ADMIN alike, none of whom necessarily share a tenant. Rows are created lazily (on the
 * first PATCH) rather than seeded at signup - a missing row simply means "still on the
 * default", not a data problem.
 */
@Injectable()
export class PreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(userId: string): Promise<PreferencesResponseDto> {
    const row = await this.prisma.userPreference.findUnique({ where: { userId } });
    return { themeMode: row?.themeMode ?? DEFAULT_THEME_MODE };
  }

  async update(userId: string, themeMode: string): Promise<PreferencesResponseDto> {
    if (!isValidThemeMode(themeMode)) {
      throw new BadRequestException(`Unknown theme mode "${themeMode}"`);
    }

    const row = await this.prisma.userPreference.upsert({
      where: { userId },
      create: { userId, themeMode },
      update: { themeMode },
    });

    return { themeMode: row.themeMode };
  }
}
