import { Global, Module } from '@nestjs/common';
import { TenantAccessService } from './tenant-access.service';

/**
 * Global: this is a pure decision service with no controller, consulted from several
 * otherwise-unrelated modules (public profile, tenant lifecycle, future billing webhooks).
 */
@Global()
@Module({
  providers: [TenantAccessService],
  exports: [TenantAccessService],
})
export class TenantAccessModule {}
