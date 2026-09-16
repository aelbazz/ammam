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
import { TimelineEventService } from './timeline-event.service';
import {
  CreateTimelineEventDto,
  TimelineEventResponseDto,
  UpdateTimelineEventDto,
} from './dto/timeline-event.dto';
import { ReorderDto } from '../experience/dto/experience.dto';

@ApiTags('timeline-events')
@ApiBearerAuth()
@Controller('timeline-events')
export class TimelineEventController {
  constructor(private readonly service: TimelineEventService) {}

  @Get()
  @ApiOperation({ summary: 'List timeline events in display order' })
  @ApiResponse({ status: 200, type: [TimelineEventResponseDto] })
  findAll(): Promise<TimelineEventResponseDto[]> {
    return this.service.findAll(true);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one timeline event' })
  @ApiResponse({ status: 200, type: TimelineEventResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(@Param('id') id: string): Promise<TimelineEventResponseDto> {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a timeline event' })
  @ApiResponse({ status: 201, type: TimelineEventResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Body() dto: CreateTimelineEventDto): Promise<TimelineEventResponseDto> {
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
  @ApiOperation({ summary: 'Update a timeline event' })
  @ApiResponse({ status: 200, type: TimelineEventResponseDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTimelineEventDto,
  ): Promise<TimelineEventResponseDto> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a timeline event' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  remove(@Param('id') id: string): Promise<void> {
    return this.service.remove(id);
  }
}
