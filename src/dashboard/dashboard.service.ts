import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SectionService } from '../section/section.service';
import { DashboardResponseDto } from './dto/dashboard.dto';

/**
 * One aggregated call for the client's post-login landing page - replaces what used to be
 * eight separate content-count requests from the Angular dashboard. See docs/SAAS-ARCHITECTURE.md.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sections: SectionService,
    private readonly config: ConfigService,
  ) {}

  async findOne(tenantId: string): Promise<DashboardResponseDto> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { person: true, theme: true },
    });
    if (!tenant || !tenant.person) throw new NotFoundException('Tenant or profile not found');

    const sectionRows = await this.sections.findAllForTenant(tenantId);
    const itemCount = (key: string) =>
      sectionRows.find((s) => s.sectionKey === key)?.itemCount ?? 0;
    const statistics: DashboardResponseDto['statistics'] = {
      experience: itemCount('experience'),
      projects: itemCount('projects'),
      skills: itemCount('skills'),
      achievements: itemCount('achievements'),
      courses: itemCount('courses'),
      timeline: itemCount('timeline'),
      management: itemCount('management'),
    };

    const frontendPublicUrl =
      this.config.get<string>('FRONTEND_PUBLIC_URL') ?? 'http://localhost:4100';

    return {
      tenant: { id: tenant.id, name: tenant.name, status: tenant.status },
      person: {
        name: tenant.person.name,
        title: tenant.person.title,
        avatar: tenant.person.avatar,
        avatarSource: tenant.person.avatarSource,
      },
      publicSite: {
        slug: tenant.slug,
        url: `${frontendPublicUrl}/${tenant.slug}`,
        isPublished: tenant.isPublished,
      },
      appearance: {
        designSystem: tenant.theme?.designSystem ?? 'modern',
        layout: tenant.theme?.layout ?? 'classic',
        primaryColor: tenant.theme?.primaryColor ?? '#6366f1',
      },
      sections: sectionRows.map((s) => ({
        sectionKey: s.sectionKey,
        label: s.label,
        enabled: s.enabled,
        itemCount: s.itemCount,
      })),
      statistics,
    };
  }
}
