import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, Subscription, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { SubscriptionResponseDto, UpdateSubscriptionDto } from './dto/billing.dto';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  /** Admin: every subscription, with filtering - GET /admin/subscriptions. */
  async findAllForAdmin(filters: {
    status?: string;
    tenantId?: string;
    planId?: string;
  }): Promise<SubscriptionResponseDto[]> {
    const rows = await this.prisma.subscription.findMany({
      where: {
        ...(filters.status ? { status: filters.status as never } : {}),
        ...(filters.tenantId ? { tenantId: filters.tenantId } : {}),
        ...(filters.planId ? { planId: filters.planId } : {}),
      },
      orderBy: { renewalDate: 'asc' },
      include: this.include(),
    });
    return rows.map((s) => this.toDto(s));
  }

  /** CLIENT: read-only view of their own tenant's subscription. */
  async findForTenant(tenantId: string): Promise<SubscriptionResponseDto> {
    const sub = await this.prisma.subscription.findUnique({
      where: { tenantId },
      include: this.include(),
    });
    if (!sub) throw new NotFoundException('No subscription found for this tenant');
    return this.toDto(sub);
  }

  /** Admin only - a CLIENT can never reach this method (no controller route calls it). */
  async update(
    actor: AuthenticatedUser,
    tenantId: string,
    dto: UpdateSubscriptionDto,
  ): Promise<SubscriptionResponseDto> {
    const existing = await this.prisma.subscription.findUnique({ where: { tenantId } });
    if (!existing) throw new NotFoundException('No subscription found for this tenant');

    if (dto.planId) {
      const plan = await this.prisma.plan.findUnique({ where: { id: dto.planId } });
      if (!plan) throw new BadRequestException(`Plan ${dto.planId} does not exist`);
    }

    const data: Prisma.SubscriptionUpdateInput = {};
    if (dto.status) data.status = dto.status;
    if (dto.planId) data.plan = { connect: { id: dto.planId } };
    if (dto.expiresAt !== undefined)
      data.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (dto.renewalDate !== undefined)
      data.renewalDate = dto.renewalDate ? new Date(dto.renewalDate) : null;
    if (dto.autoRenew !== undefined) data.autoRenew = dto.autoRenew;

    const updated = await this.prisma.subscription.update({
      where: { tenantId },
      data,
      include: this.include(),
    });

    await this.auditLog.log({
      actor,
      tenantId,
      action: 'SUBSCRIPTION_UPDATED',
      resource: 'subscription',
      resourceId: updated.id,
      metadata: { from: existing.status, to: updated.status },
    });

    return this.toDto(updated);
  }

  /**
   * Flips every subscription whose expiresAt has passed to EXPIRED - nothing else watches
   * this date. Run on a schedule (SubscriptionExpiryJob) and reachable on demand via
   * POST /admin/subscriptions/expire-overdue, so an admin isn't stuck waiting for the next
   * scheduled run, and so this is testable over HTTP without manipulating the clock.
   *
   * Only TRIAL/ACTIVE/PAST_DUE are eligible - an already-EXPIRED, SUSPENDED or CANCELLED
   * subscription has nothing to transition to here. A tenant with no expiresAt (ongoing,
   * no fixed term) is never touched.
   */
  async expireOverdue(): Promise<number> {
    const overdue = await this.prisma.subscription.findMany({
      where: {
        expiresAt: { lte: new Date() },
        status: {
          in: [SubscriptionStatus.TRIAL, SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE],
        },
      },
    });

    for (const sub of overdue) {
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { status: SubscriptionStatus.EXPIRED },
      });

      await this.auditLog.log({
        actor: null,
        tenantId: sub.tenantId,
        action: 'SUBSCRIPTION_EXPIRED',
        resource: 'subscription',
        resourceId: sub.id,
        metadata: { from: sub.status, to: SubscriptionStatus.EXPIRED, expiresAt: sub.expiresAt },
      });
    }

    if (overdue.length > 0) {
      this.logger.log(`Expired ${overdue.length} overdue subscription(s).`);
    }

    return overdue.length;
  }

  private include() {
    return {
      tenant: { select: { slug: true, name: true } },
      plan: { select: { name: true } },
    } satisfies Prisma.SubscriptionInclude;
  }

  private toDto(
    sub: Subscription & { tenant?: { slug: string; name: string }; plan?: { name: string } },
  ): SubscriptionResponseDto {
    const daysRemaining = sub.renewalDate
      ? Math.ceil((sub.renewalDate.getTime() - Date.now()) / MS_PER_DAY)
      : null;

    return {
      id: sub.id,
      tenantId: sub.tenantId,
      tenantSlug: sub.tenant?.slug,
      tenantName: sub.tenant?.name,
      planId: sub.planId,
      planName: sub.plan?.name,
      status: sub.status,
      startedAt: sub.startedAt,
      expiresAt: sub.expiresAt,
      renewalDate: sub.renewalDate,
      autoRenew: sub.autoRenew,
      daysRemaining,
    };
  }
}
