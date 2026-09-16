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

@ApiTags('achievements')
@ApiBearerAuth()
@Controller('achievements')
export class AchievementController {
  constructor(private readonly service: AchievementService) {}

  @Get()
  @ApiOperation({ summary: 'List achievements' })
  @ApiResponse({ status: 200, type: [AchievementResponseDto] })
  findAll(): Promise<AchievementResponseDto[]> {
    return this.service.findAll(true);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one achievement' })
  @ApiResponse({ status: 200, type: AchievementResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(@Param('id') id: string): Promise<AchievementResponseDto> {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create an achievement' })
  @ApiResponse({ status: 201, type: AchievementResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Body() dto: CreateAchievementDto): Promise<AchievementResponseDto> {
    return this.service.create(dto);
  }

  @Patch('reorder')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Bulk-update display order' })
  @ApiResponse({ status: 204, description: 'Reordered' })
  reorder(@Body() dto: ReorderDto): Promise<void> {
    return this.service.reorder(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an achievement' })
  @ApiResponse({ status: 200, type: AchievementResponseDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAchievementDto,
  ): Promise<AchievementResponseDto> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an achievement' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  remove(@Param('id') id: string): Promise<void> {
    return this.service.remove(id);
  }
}
