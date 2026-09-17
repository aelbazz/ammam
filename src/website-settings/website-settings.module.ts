import { Module } from '@nestjs/common';
import { WebsiteSettingsService } from './website-settings.service';
import { WebsiteSettingsController } from './website-settings.controller';

@Module({
  controllers: [WebsiteSettingsController],
  providers: [WebsiteSettingsService],
})
export class WebsiteSettingsModule {}
