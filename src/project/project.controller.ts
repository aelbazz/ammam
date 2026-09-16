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
import { ProjectService } from './project.service';
import {
  CreateProjectDto,
  ProjectHighlightResponseDto,
  ProjectResponseDto,
  UpdateProjectDto,
} from './dto/project.dto';
import { CreateChildItemDto, ReorderDto } from '../experience/dto/experience.dto';
import { AttachTechnologyDto } from '../technology/dto/technology.dto';

@ApiTags('projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectController {
  constructor(private readonly service: ProjectService) {}

  @Get()
  @ApiOperation({ summary: 'List projects (published only for anonymous callers)' })
  @ApiResponse({ status: 200, type: [ProjectResponseDto] })
  findAll(): Promise<ProjectResponseDto[]> {
    return this.service.findAll(true);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one project with highlights and technologies' })
  @ApiResponse({ status: 200, type: ProjectResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(@Param('id') id: string): Promise<ProjectResponseDto> {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a project' })
  @ApiResponse({ status: 201, type: ProjectResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Body() dto: CreateProjectDto): Promise<ProjectResponseDto> {
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
  @ApiOperation({ summary: 'Update a project' })
  @ApiResponse({ status: 200, type: ProjectResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto): Promise<ProjectResponseDto> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a project and its highlights' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  remove(@Param('id') id: string): Promise<void> {
    return this.service.remove(id);
  }

  @Post(':id/highlights')
  @ApiOperation({ summary: 'Add a highlight to a project' })
  @ApiResponse({ status: 201, type: ProjectHighlightResponseDto })
  addHighlight(
    @Param('id') id: string,
    @Body() dto: CreateChildItemDto,
  ): Promise<ProjectHighlightResponseDto> {
    return this.service.addHighlight(id, dto);
  }

  @Delete('highlights/:highlightId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a highlight' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  removeHighlight(@Param('highlightId') highlightId: string): Promise<void> {
    return this.service.removeHighlight(highlightId);
  }

  @Post(':id/technologies')
  @ApiOperation({
    summary: 'Attach a technology by name',
    description: 'Reuses the existing technology when one matches; never creates a duplicate.',
  })
  @ApiResponse({ status: 201, type: ProjectResponseDto })
  attachTechnology(
    @Param('id') id: string,
    @Body() dto: AttachTechnologyDto,
  ): Promise<ProjectResponseDto> {
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
