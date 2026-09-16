import { Module } from '@nestjs/common';
import { ExperienceController } from './experience.controller';
import { ExperienceService } from './experience.service';
import { TechnologyModule } from '../technology/technology.module';
import { PersonModule } from '../person/person.module';

@Module({
  imports: [TechnologyModule, PersonModule],
  controllers: [ExperienceController],
  providers: [ExperienceService],
})
export class ExperienceModule {}
