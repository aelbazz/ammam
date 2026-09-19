import { Module } from '@nestjs/common';
import { ThemeService } from './theme.service';
import { ThemeController } from './theme.controller';
import { DesignRegistryController } from './design-registry.controller';

@Module({
  controllers: [ThemeController, DesignRegistryController],
  providers: [ThemeService],
})
export class ThemeModule {}
