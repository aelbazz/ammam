import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AchievementService } from './achievement.service';
import {
  AchievementResponseDto,
  CreateAchievementDto,
  UpdateAchievementDto,
} from './dto/achievement.dto';
import { ReorderDto } from '../experience/dto/experience.dto';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('achievements')
@ApiBearerAuth()
@Controller('achievements')
export class AchievementController {
  constructor(private readonly service: AchievementService) {}

  @Get()
  @ApiOperation({ summary: 'List achievements' })
  @ApiResponse({ status: 200, type: [AchievementResponseDto] })
  findAll(@CurrentUser() user: AuthenticatedUser): Promise<AchievementResponseDto[]> {
    return this.service.findAll(user.personId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one achievement' })
  @ApiResponse({ status: 200, type: AchievementResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<AchievementResponseDto> {
    return this.service.findOne(user.personId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create an achievement' })
  @ApiResponse({ status: 201, type: AchievementResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAchievementDto,
  ): Promise<AchievementResponseDto> {
    return this.service.create(user.personId, dto);
  }

  @Patch('reorder')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Bulk-update display order' })
  @ApiResponse({ status: 204, description: 'Reordered' })
  reorder(@CurrentUser() user: AuthenticatedUser, @Body() dto: ReorderDto): Promise<void> {
    return this.service.reorder(user.personId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an achievement' })
  @ApiResponse({ status: 200, type: AchievementResponseDto })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAchievementDto,
  ): Promise<AchievementResponseDto> {
    return this.service.update(user.personId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an achievement' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    return this.service.remove(user.personId, id);
  }
}
