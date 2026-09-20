import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { LocalStorageService } from './local-storage.service';

/**
 * Global so a future second consumer (a tenant logo upload, say) doesn't need this module
 * re-declared - matches TenantAccessModule's existing precedent for small, stateless,
 * widely-useful services.
 */
@Global()
@Module({
  providers: [{ provide: StorageService, useClass: LocalStorageService }],
  exports: [StorageService],
})
export class StorageModule {}
