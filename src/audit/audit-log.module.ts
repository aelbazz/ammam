import { Global, Module } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { AuditLogController } from './audit-log.controller';

/**
 * Global: AuditLogService is injected from many otherwise-unrelated modules (tenant
 * lifecycle, theme, profile mutations), and none of them should need to import a whole
 * audit module just to call .log().
 */
@Global()
@Module({
  controllers: [AuditLogController],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogModule {}
