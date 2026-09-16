import { Module } from '@nestjs/common';
import { SkillController } from './skill.controller';
import { SkillService } from './skill.service';
import { PersonModule } from '../person/person.module';

@Module({
  imports: [PersonModule],
  controllers: [SkillController],
  providers: [SkillService],
})
export class SkillModule {}
