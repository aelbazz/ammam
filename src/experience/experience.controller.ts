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
import { ExperienceService } from './experience.service';
import {
  ChildItemResponseDto,
  CreateChildItemDto,
  CreateExperienceDto,
  ExperienceResponseDto,
  ReorderDto,
  UpdateChildItemDto,
  UpdateExperienceDto,
} from './dto/experience.dto';
import { AttachTechnologyDto } from '../technology/dto/technology.dto';

@ApiTags('experiences')
@ApiBearerAuth()
@Controller('experiences')
export class ExperienceController {
  constructor(private readonly service: ExperienceService) {}

  @Get()
  @ApiOperation({ summary: 'List experiences (published only for anonymous callers)' })
  @ApiResponse({ status: 200, type: [ExperienceResponseDto] })
  findAll(): Promise<ExperienceResponseDto[]> {
    return this.service.findAll(true);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one experience with its responsibilities and technologies' })
  @ApiResponse({ status: 200, type: ExperienceResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(@Param('id') id: string): Promise<ExperienceResponseDto> {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create an experience, optionally with nested children' })
  @ApiResponse({ status: 201, type: ExperienceResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Body() dto: CreateExperienceDto): Promise<ExperienceResponseDto> {
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
  @ApiOperation({
    summary: 'Update an experience',
    description:
      'Omitted child arrays are left untouched; sending an empty array clears that collection.',
  })
  @ApiResponse({ status: 200, type: ExperienceResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateExperienceDto,
  ): Promise<ExperienceResponseDto> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an experience and all of its children' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  remove(@Param('id') id: string): Promise<void> {
    return this.service.remove(id);
  }

  // -- responsibilities -------------------------------------------------------

  @Post(':id/responsibilities')
  @ApiOperation({ summary: 'Add a responsibility to an experience' })
  @ApiResponse({ status: 201, type: ChildItemResponseDto })
  addResponsibility(
    @Param('id') id: string,
    @Body() dto: CreateChildItemDto,
  ): Promise<ChildItemResponseDto> {
    return this.service.addResponsibility(id, dto);
  }

  @Patch('responsibilities/:responsibilityId')
  @ApiOperation({ summary: 'Update a responsibility' })
  @ApiResponse({ status: 200, type: ChildItemResponseDto })
  updateResponsibility(
    @Param('responsibilityId') responsibilityId: string,
    @Body() dto: UpdateChildItemDto,
  ): Promise<ChildItemResponseDto> {
    return this.service.updateResponsibility(responsibilityId, dto);
  }

  @Delete('responsibilities/:responsibilityId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a responsibility' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  removeResponsibility(@Param('responsibilityId') responsibilityId: string): Promise<void> {
    return this.service.removeResponsibility(responsibilityId);
  }

  // -- achievements -----------------------------------------------------------

  @Post(':id/achievements')
  @ApiOperation({ summary: 'Add an achievement to an experience' })
  @ApiResponse({ status: 201, type: ChildItemResponseDto })
  addAchievement(
    @Param('id') id: string,
    @Body() dto: CreateChildItemDto,
  ): Promise<ChildItemResponseDto> {
    return this.service.addAchievement(id, dto);
  }

  @Delete('achievements/:achievementId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an experience achievement' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  removeAchievement(@Param('achievementId') achievementId: string): Promise<void> {
    return this.service.removeAchievement(achievementId);
  }

  // -- technologies -----------------------------------------------------------

  @Post(':id/technologies')
  @ApiOperation({
    summary: 'Attach a technology by name',
    description: 'Reuses the existing technology when one matches; never creates a duplicate.',
  })
  @ApiResponse({ status: 201, type: ExperienceResponseDto })
  attachTechnology(
    @Param('id') id: string,
    @Body() dto: AttachTechnologyDto,
  ): Promise<ExperienceResponseDto> {
    return this.service.attachTechnology(id, dto);
  }

  @Delete(':id/technologies/:technologyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Detach a technology (the technology itself is not deleted)' })
  @ApiResponse({ status: 204, description: 'Detached' })
  detachTechnology(
    @Param('id') id: string,
    @Param('technologyId') technologyId: string,
  ): Promise<void> {
    return this.service.detachTechnology(id, technologyId);
  }
}
