import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { PublicProfileService } from './public.service';
import { CvModule } from '../cv/cv.module';

@Module({
  imports: [CvModule],
  controllers: [PublicController],
  providers: [PublicProfileService],
  exports: [PublicProfileService],
})
export class PublicModule {}
