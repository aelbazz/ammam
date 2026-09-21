import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { SectionModule } from '../section/section.module';
import { PreferencesModule } from '../preferences/preferences.module';

@Module({
  imports: [SectionModule, PreferencesModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
