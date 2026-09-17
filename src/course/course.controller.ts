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
import { CourseService } from './course.service';
import { CourseResponseDto, CreateCourseDto, UpdateCourseDto } from './dto/course.dto';
import { ReorderDto } from '../experience/dto/experience.dto';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('courses')
@ApiBearerAuth()
@Controller('courses')
export class CourseController {
  constructor(private readonly service: CourseService) {}

  @Get()
  @ApiOperation({ summary: 'List courses with their topics' })
  @ApiResponse({ status: 200, type: [CourseResponseDto] })
  findAll(@CurrentUser() user: AuthenticatedUser): Promise<CourseResponseDto[]> {
    return this.service.findAll(user.personId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one course' })
  @ApiResponse({ status: 200, type: CourseResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<CourseResponseDto> {
    return this.service.findOne(user.personId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a course' })
  @ApiResponse({ status: 201, type: CourseResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCourseDto,
  ): Promise<CourseResponseDto> {
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
  @ApiOperation({ summary: 'Update a course (omitted skills are left untouched)' })
  @ApiResponse({ status: 200, type: CourseResponseDto })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCourseDto,
  ): Promise<CourseResponseDto> {
    return this.service.update(user.personId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a course and its topics' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    return this.service.remove(user.personId, id);
  }
}
