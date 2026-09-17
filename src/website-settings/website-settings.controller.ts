import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { WebsiteSettingsService } from './website-settings.service';
import { UpdateWebsiteSettingsDto, WebsiteSettingsResponseDto } from './dto/website-settings.dto';

@ApiTags('tenant')
@ApiBearerAuth()
@Roles(Role.CLIENT)
@Controller('tenant/settings')
export class WebsiteSettingsController {
  constructor(private readonly settings: WebsiteSettingsService) {}

  @Get()
  @ApiOperation({ summary: "Get my tenant's website-level settings (SEO, sections, branding)" })
  @ApiResponse({ status: 200, type: WebsiteSettingsResponseDto })
  findOne(@CurrentUser() user: AuthenticatedUser) {
    return this.settings.findOne(user.tenantId!);
  }

  @Patch()
  @ApiOperation({ summary: 'Update my website settings' })
  @ApiResponse({ status: 200, type: WebsiteSettingsResponseDto })
  update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateWebsiteSettingsDto) {
    return this.settings.update(user.tenantId!, dto);
  }
}
