import { Injectable, NotFoundException } from '@nestjs/common';
import { Payment } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CreatePaymentDto, PaymentResponseDto } from './dto/billing.dto';

/**
 * Provider-agnostic payment records. `provider` is "manual" until a real processor is
 * integrated; that integration only ever needs to add rows here and flip
 * Subscription.status via a webhook handler - it never has to touch this shape. Payment
 * status is set here, by an Admin or a future webhook, and is never accepted from a client.
 */
@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async findAll(tenantId?: string): Promise<PaymentResponseDto[]> {
    const rows = await this.prisma.payment.findMany({
      where: tenantId ? { tenantId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { tenant: { select: { slug: true } } },
    });
    return rows.map((p) => this.toDto(p));
  }

  async findForTenant(tenantId: string): Promise<PaymentResponseDto[]> {
    return this.findAll(tenantId);
  }

  async record(actor: AuthenticatedUser, dto: CreatePaymentDto): Promise<PaymentResponseDto> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: dto.tenantId } });
    if (!tenant) throw new NotFoundException(`Tenant ${dto.tenantId} not found`);

    const payment = await this.prisma.payment.create({
      data: {
        tenantId: dto.tenantId,
        subscriptionId: dto.subscriptionId,
        amount: dto.amount,
        currency: dto.currency ?? 'USD',
        status: dto.status ?? 'PAID',
        provider: dto.provider ?? 'manual',
        providerTransactionId: dto.providerTransactionId,
        paidAt: (dto.status ?? 'PAID') === 'PAID' ? new Date() : null,
      },
      include: { tenant: { select: { slug: true } } },
    });

    await this.auditLog.log({
      actor,
      tenantId: dto.tenantId,
      action: 'PAYMENT_RECORDED',
      resource: 'payment',
      resourceId: payment.id,
      metadata: { amount: dto.amount, status: payment.status },
    });

    return this.toDto(payment);
  }

  private toDto(payment: Payment & { tenant?: { slug: string } }): PaymentResponseDto {
    return {
      id: payment.id,
      tenantId: payment.tenantId,
      tenantSlug: payment.tenant?.slug,
      subscriptionId: payment.subscriptionId,
      amount: payment.amount.toString(),
      currency: payment.currency,
      status: payment.status,
      provider: payment.provider,
      providerTransactionId: payment.providerTransactionId,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
    };
  }
}
