import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { PublicProfileService } from './public.service';

@Module({
  controllers: [PublicController],
  providers: [PublicProfileService],
  exports: [PublicProfileService],
})
export class PublicModule {}
