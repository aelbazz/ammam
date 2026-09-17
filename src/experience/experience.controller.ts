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
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('experiences')
@ApiBearerAuth()
@Roles(Role.CLIENT)
@Controller('tenant/experiences')
export class ExperienceController {
  constructor(private readonly service: ExperienceService) {}

  @Get()
  @ApiOperation({ summary: 'List experiences (published only for anonymous callers)' })
  @ApiResponse({ status: 200, type: [ExperienceResponseDto] })
  findAll(@CurrentUser() user: AuthenticatedUser): Promise<ExperienceResponseDto[]> {
    return this.service.findAll(user.personId!);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one experience with its responsibilities and technologies' })
  @ApiResponse({ status: 200, type: ExperienceResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<ExperienceResponseDto> {
    return this.service.findOne(user.personId!, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create an experience, optionally with nested children' })
  @ApiResponse({ status: 201, type: ExperienceResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateExperienceDto,
  ): Promise<ExperienceResponseDto> {
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
  @ApiOperation({
    summary: 'Update an experience',
    description:
      'Omitted child arrays are left untouched; sending an empty array clears that collection.',
  })
  @ApiResponse({ status: 200, type: ExperienceResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateExperienceDto,
  ): Promise<ExperienceResponseDto> {
    return this.service.update(user.personId!, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an experience and all of its children' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    return this.service.remove(user.personId!, id);
  }

  // -- responsibilities -------------------------------------------------------

  @Post(':id/responsibilities')
  @ApiOperation({ summary: 'Add a responsibility to an experience' })
  @ApiResponse({ status: 201, type: ChildItemResponseDto })
  addResponsibility(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateChildItemDto,
  ): Promise<ChildItemResponseDto> {
    return this.service.addResponsibility(user.personId!, id, dto);
  }

  @Patch('responsibilities/:responsibilityId')
  @ApiOperation({ summary: 'Update a responsibility' })
  @ApiResponse({ status: 200, type: ChildItemResponseDto })
  updateResponsibility(
    @CurrentUser() user: AuthenticatedUser,
    @Param('responsibilityId') responsibilityId: string,
    @Body() dto: UpdateChildItemDto,
  ): Promise<ChildItemResponseDto> {
    return this.service.updateResponsibility(user.personId!, responsibilityId, dto);
  }

  @Delete('responsibilities/:responsibilityId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a responsibility' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  removeResponsibility(
    @CurrentUser() user: AuthenticatedUser,
    @Param('responsibilityId') responsibilityId: string,
  ): Promise<void> {
    return this.service.removeResponsibility(user.personId!, responsibilityId);
  }

  // -- achievements -----------------------------------------------------------

  @Post(':id/achievements')
  @ApiOperation({ summary: 'Add an achievement to an experience' })
  @ApiResponse({ status: 201, type: ChildItemResponseDto })
  addAchievement(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateChildItemDto,
  ): Promise<ChildItemResponseDto> {
    return this.service.addAchievement(user.personId!, id, dto);
  }

  @Delete('achievements/:achievementId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an experience achievement' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  removeAchievement(
    @CurrentUser() user: AuthenticatedUser,
    @Param('achievementId') achievementId: string,
  ): Promise<void> {
    return this.service.removeAchievement(user.personId!, achievementId);
  }

  // -- technologies -----------------------------------------------------------

  @Post(':id/technologies')
  @ApiOperation({
    summary: 'Attach a technology by name',
    description: 'Reuses the existing technology when one matches; never creates a duplicate.',
  })
  @ApiResponse({ status: 201, type: ExperienceResponseDto })
  attachTechnology(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AttachTechnologyDto,
  ): Promise<ExperienceResponseDto> {
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
