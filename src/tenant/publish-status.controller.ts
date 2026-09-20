import { Body, Controller, Get, NotFoundException, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { PublishStatusResponseDto, UpdatePublishStatusDto } from './dto/publish-status.dto';

/**
 * The client's own "is my profile live" switch - distinct from the admin-controlled
 * Tenant.status. See TenantAccessService.isPubliclyAccessible, which treats an unpublished
 * profile the same as a nonexistent slug (404, not 403).
 */
@ApiTags('tenant')
@ApiBearerAuth()
@Roles(Role.CLIENT)
@Controller('tenant/publish-status')
export class PublishStatusController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Whether my public profile is currently published' })
  @ApiResponse({ status: 200, type: PublishStatusResponseDto })
  async findOne(@CurrentUser() user: AuthenticatedUser): Promise<PublishStatusResponseDto> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId! },
      select: { isPublished: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  @Patch()
  @ApiOperation({ summary: 'Publish or unpublish my public profile' })
  @ApiResponse({ status: 200, type: PublishStatusResponseDto })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePublishStatusDto,
  ): Promise<PublishStatusResponseDto> {
    return this.prisma.tenant.update({
      where: { id: user.tenantId! },
      data: { isPublished: dto.isPublished },
      select: { isPublished: true },
    });
  }
}
