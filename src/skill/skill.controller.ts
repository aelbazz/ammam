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
import { SkillService } from './skill.service';
import {
  CreateSkillCategoryDto,
  CreateSkillDto,
  SkillCategoryResponseDto,
  SkillResponseDto,
  UpdateSkillCategoryDto,
  UpdateSkillDto,
} from './dto/skill.dto';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('skills')
@ApiBearerAuth()
@Controller('skill-categories')
export class SkillController {
  constructor(private readonly service: SkillService) {}

  @Get()
  @ApiOperation({ summary: 'List skill categories with their skills' })
  @ApiResponse({ status: 200, type: [SkillCategoryResponseDto] })
  findAll(@CurrentUser() user: AuthenticatedUser): Promise<SkillCategoryResponseDto[]> {
    return this.service.findAllCategories(user.personId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one skill category' })
  @ApiResponse({ status: 200, type: SkillCategoryResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<SkillCategoryResponseDto> {
    return this.service.findCategory(user.personId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a skill category' })
  @ApiResponse({ status: 201, type: SkillCategoryResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  createCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSkillCategoryDto,
  ): Promise<SkillCategoryResponseDto> {
    return this.service.createCategory(user.personId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a skill category' })
  @ApiResponse({ status: 200, type: SkillCategoryResponseDto })
  updateCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateSkillCategoryDto,
  ): Promise<SkillCategoryResponseDto> {
    return this.service.updateCategory(user.personId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a category and all of its skills' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  removeCategory(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    return this.service.removeCategory(user.personId, id);
  }

  @Post(':id/skills')
  @ApiOperation({ summary: 'Add a skill to a category' })
  @ApiResponse({ status: 201, type: SkillResponseDto })
  addSkill(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateSkillDto,
  ): Promise<SkillResponseDto> {
    return this.service.addSkill(user.personId, id, dto);
  }

  @Patch('skills/:skillId')
  @ApiOperation({ summary: 'Update a skill' })
  @ApiResponse({ status: 200, type: SkillResponseDto })
  updateSkill(
    @CurrentUser() user: AuthenticatedUser,
    @Param('skillId') skillId: string,
    @Body() dto: UpdateSkillDto,
  ): Promise<SkillResponseDto> {
    return this.service.updateSkill(user.personId, skillId, dto);
  }

  @Delete('skills/:skillId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a skill' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  removeSkill(
    @CurrentUser() user: AuthenticatedUser,
    @Param('skillId') skillId: string,
  ): Promise<void> {
    return this.service.removeSkill(user.personId, skillId);
  }
}
