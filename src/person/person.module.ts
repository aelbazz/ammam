import { Module } from '@nestjs/common';
import { PersonController } from './person.controller';
import { PersonService } from './person.service';
import { AvatarController } from './avatar.controller';
import { AvatarService } from './avatar.service';

@Module({
  controllers: [PersonController, AvatarController],
  providers: [PersonService, AvatarService],
  exports: [PersonService],
})
export class PersonModule {}
