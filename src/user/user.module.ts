import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { AdminUserController } from './admin-user.controller';

@Module({
  controllers: [AdminUserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
