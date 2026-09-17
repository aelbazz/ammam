import { Module } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { TenantLifecycleService } from './tenant-lifecycle.service';
import { AdminTenantController } from './admin-tenant.controller';
import { CoordinatorTenantController } from './coordinator-tenant.controller';
import { TenantMeController } from './tenant-me.controller';

@Module({
  controllers: [AdminTenantController, CoordinatorTenantController, TenantMeController],
  providers: [TenantService, TenantLifecycleService],
  exports: [TenantService],
})
export class TenantModule {}
