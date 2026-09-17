import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { ThemeService } from './theme.service';
import { ThemeResponseDto, UpdateThemeDto } from './dto/theme.dto';

@ApiTags('tenant')
@ApiBearerAuth()
@Roles(Role.CLIENT)
@Controller('tenant/theme')
export class ThemeController {
  constructor(private readonly theme: ThemeService) {}

  @Get()
  @ApiOperation({ summary: "Get my tenant's visual theme" })
  @ApiResponse({ status: 200, type: ThemeResponseDto })
  findOne(@CurrentUser() user: AuthenticatedUser) {
    return this.theme.findOne(user.tenantId!);
  }

  @Patch()
  @ApiOperation({ summary: 'Update my theme' })
  @ApiResponse({ status: 200, type: ThemeResponseDto })
  update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateThemeDto) {
    return this.theme.update(user.tenantId!, dto);
  }
}
