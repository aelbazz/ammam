import { Module } from '@nestjs/common';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';
import { PersonModule } from '../person/person.module';

@Module({
  imports: [PersonModule],
  controllers: [ContactController],
  providers: [ContactService],
})
export class ContactModule {}
