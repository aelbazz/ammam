import { Module } from '@nestjs/common';
import { ManagementRoleController } from './management-role.controller';
import { ManagementRoleService } from './management-role.service';
import { PersonModule } from '../person/person.module';

@Module({
  imports: [PersonModule],
  controllers: [ManagementRoleController],
  providers: [ManagementRoleService],
})
export class ManagementRoleModule {}
