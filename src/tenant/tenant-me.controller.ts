import { Controller, Get, Inject, NotFoundException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

export class TenantMeDto {
  id!: string;
  slug!: string;
  name!: string;
  status!: string;
  subscriptionStatus!: string | null;
  planName!: string | null;
}

@ApiTags('tenant')
@ApiBearerAuth()
@Roles(Role.CLIENT)
@Controller('tenant/me')
export class TenantMeController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Identify the current tenant - the profile this CLIENT manages' })
  @ApiResponse({ status: 200, type: TenantMeDto })
  async me(@CurrentUser() user: AuthenticatedUser): Promise<TenantMeDto> {
    // user.tenantId is resolved server-side from the JWT during validation - never
    // client-supplied - so this can never return another tenant's data.
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId! },
      include: { subscription: { include: { plan: true } } },
    });

    if (!tenant) throw new NotFoundException('Tenant not found');

    return {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      status: tenant.status,
      subscriptionStatus: tenant.subscription?.status ?? null,
      planName: tenant.subscription?.plan.name ?? null,
    };
  }
}
