import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { SectionModule } from '../section/section.module';

@Module({
  imports: [SectionModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
