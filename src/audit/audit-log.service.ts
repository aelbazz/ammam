import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';

export interface AuditLogEntry {
  actor: AuthenticatedUser | null;
  tenantId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  /** Small, structured, non-sensitive context - e.g. { from: 'ACTIVE', to: 'SUSPENDED' }. */
  metadata?: Record<string, unknown>;
}

/**
 * Append-only audit trail. Never logs a password, token, or secret - callers pass
 * `metadata`, which is free-form but is the caller's responsibility to keep non-sensitive;
 * this service does not attempt to redact it.
 *
 * Logging failures are swallowed rather than thrown: an audit-log write must never be the
 * reason a real mutation (suspending a tenant, say) fails to commit.
 */
@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: entry.actor?.id ?? null,
          actorRole: entry.actor?.role ?? null,
          tenantId: entry.tenantId ?? null,
          action: entry.action,
          resource: entry.resource,
          resourceId: entry.resourceId ?? null,
          metadata: (entry.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        },
      });
    } catch {
      // Deliberately swallowed - see class doc.
    }
  }

  async list(params: {
    tenantId?: string;
    actorId?: string;
    action?: string;
    page?: number;
    limit?: number;
  }) {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 50, 200);

    const where = {
      ...(params.tenantId ? { tenantId: params.tenantId } : {}),
      ...(params.actorId ? { actorId: params.actorId } : {}),
      ...(params.action ? { action: params.action } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data, total, page, limit };
  }
}
