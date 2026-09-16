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

@ApiTags('courses')
@ApiBearerAuth()
@Controller('courses')
export class CourseController {
  constructor(private readonly service: CourseService) {}

  @Get()
  @ApiOperation({ summary: 'List courses with their topics' })
  @ApiResponse({ status: 200, type: [CourseResponseDto] })
  findAll(): Promise<CourseResponseDto[]> {
    return this.service.findAll(true);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one course' })
  @ApiResponse({ status: 200, type: CourseResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(@Param('id') id: string): Promise<CourseResponseDto> {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a course' })
  @ApiResponse({ status: 201, type: CourseResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Body() dto: CreateCourseDto): Promise<CourseResponseDto> {
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
  @ApiOperation({ summary: 'Update a course (omitted skills are left untouched)' })
  @ApiResponse({ status: 200, type: CourseResponseDto })
  update(@Param('id') id: string, @Body() dto: UpdateCourseDto): Promise<CourseResponseDto> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a course and its topics' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  remove(@Param('id') id: string): Promise<void> {
    return this.service.remove(id);
  }
}
