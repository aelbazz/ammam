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
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('projects')
@ApiBearerAuth()
@Roles(Role.CLIENT)
@Controller('tenant/projects')
export class ProjectController {
  constructor(private readonly service: ProjectService) {}

  @Get()
  @ApiOperation({ summary: 'List projects (published only for anonymous callers)' })
  @ApiResponse({ status: 200, type: [ProjectResponseDto] })
  findAll(@CurrentUser() user: AuthenticatedUser): Promise<ProjectResponseDto[]> {
    return this.service.findAll(user.personId!);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one project with highlights and technologies' })
  @ApiResponse({ status: 200, type: ProjectResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<ProjectResponseDto> {
    return this.service.findOne(user.personId!, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a project' })
  @ApiResponse({ status: 201, type: ProjectResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProjectDto,
  ): Promise<ProjectResponseDto> {
    return this.service.create(user.personId!, dto);
  }

  @Patch('reorder')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Bulk-update display order' })
  @ApiResponse({ status: 204, description: 'Reordered' })
  reorder(@CurrentUser() user: AuthenticatedUser, @Body() dto: ReorderDto): Promise<void> {
    return this.service.reorder(user.personId!, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a project' })
  @ApiResponse({ status: 200, type: ProjectResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<ProjectResponseDto> {
    return this.service.update(user.personId!, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a project and its highlights' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    return this.service.remove(user.personId!, id);
  }

  @Post(':id/highlights')
  @ApiOperation({ summary: 'Add a highlight to a project' })
  @ApiResponse({ status: 201, type: ProjectHighlightResponseDto })
  addHighlight(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateChildItemDto,
  ): Promise<ProjectHighlightResponseDto> {
    return this.service.addHighlight(user.personId!, id, dto);
  }

  @Delete('highlights/:highlightId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a highlight' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  removeHighlight(
    @CurrentUser() user: AuthenticatedUser,
    @Param('highlightId') highlightId: string,
  ): Promise<void> {
    return this.service.removeHighlight(user.personId!, highlightId);
  }

  @Post(':id/technologies')
  @ApiOperation({
    summary: 'Attach a technology by name',
    description: 'Reuses the existing technology when one matches; never creates a duplicate.',
  })
  @ApiResponse({ status: 201, type: ProjectResponseDto })
  attachTechnology(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AttachTechnologyDto,
  ): Promise<ProjectResponseDto> {
    return this.service.attachTechnology(user.personId!, id, dto);
  }

  @Delete(':id/technologies/:technologyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Detach a technology (the technology itself is not deleted)' })
  @ApiResponse({ status: 204, description: 'Detached' })
  detachTechnology(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('technologyId') technologyId: string,
  ): Promise<void> {
    return this.service.detachTechnology(user.personId!, id, technologyId);
  }
}
