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
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('timeline-events')
@ApiBearerAuth()
@Controller('timeline-events')
export class TimelineEventController {
  constructor(private readonly service: TimelineEventService) {}

  @Get()
  @ApiOperation({ summary: 'List timeline events in display order' })
  @ApiResponse({ status: 200, type: [TimelineEventResponseDto] })
  findAll(@CurrentUser() user: AuthenticatedUser): Promise<TimelineEventResponseDto[]> {
    return this.service.findAll(user.personId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one timeline event' })
  @ApiResponse({ status: 200, type: TimelineEventResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<TimelineEventResponseDto> {
    return this.service.findOne(user.personId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a timeline event' })
  @ApiResponse({ status: 201, type: TimelineEventResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTimelineEventDto,
  ): Promise<TimelineEventResponseDto> {
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
  @ApiOperation({ summary: 'Update a timeline event' })
  @ApiResponse({ status: 200, type: TimelineEventResponseDto })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTimelineEventDto,
  ): Promise<TimelineEventResponseDto> {
    return this.service.update(user.personId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a timeline event' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    return this.service.remove(user.personId, id);
  }
}
