import { Module } from '@nestjs/common';
import { TimelineEventController } from './timeline-event.controller';
import { TimelineEventService } from './timeline-event.service';
import { PersonModule } from '../person/person.module';

@Module({
  imports: [PersonModule],
  controllers: [TimelineEventController],
  providers: [TimelineEventService],
})
export class TimelineEventModule {}
