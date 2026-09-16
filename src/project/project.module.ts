import { Module } from '@nestjs/common';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { TechnologyModule } from '../technology/technology.module';
import { PersonModule } from '../person/person.module';

@Module({
  imports: [TechnologyModule, PersonModule],
  controllers: [ProjectController],
  providers: [ProjectService],
})
export class ProjectModule {}
