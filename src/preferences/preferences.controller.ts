import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { PreferencesService } from './preferences.service';
import { PreferencesResponseDto, UpdatePreferencesDto } from './dto/preferences.dto';

/**
 * The Control Portal's own theme preference. Deliberately no @Roles() here - CLIENT,
 * COORDINATOR and ADMIN are all real users of this same portal chrome, and this is
 * per-user, not per-tenant, data - see GET /auth/me for the same "any authenticated caller"
 * pattern. The user is always taken from the JWT, never from the request body - a caller
 * cannot modify anyone else's preferences.
 */
@ApiTags('preferences')
@ApiBearerAuth()
@Controller('preferences')
export class PreferencesController {
  constructor(private readonly preferences: PreferencesService) {}

  @Get()
  @ApiOperation({ summary: 'My Control Portal theme preference' })
  @ApiResponse({ status: 200, type: PreferencesResponseDto })
  findOne(@CurrentUser() user: AuthenticatedUser): Promise<PreferencesResponseDto> {
    return this.preferences.findOne(user.id);
  }

  @Patch()
  @ApiOperation({ summary: 'Update my Control Portal theme preference' })
  @ApiResponse({ status: 200, type: PreferencesResponseDto })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePreferencesDto,
  ): Promise<PreferencesResponseDto> {
    return this.preferences.update(user.id, dto.themeMode);
  }
}
