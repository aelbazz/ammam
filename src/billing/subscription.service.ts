import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Subscription } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { SubscriptionResponseDto, UpdateSubscriptionDto } from './dto/billing.dto';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class SubscriptionService {
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
