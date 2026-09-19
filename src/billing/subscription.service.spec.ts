import { Test } from '@nestjs/testing';
import { SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { SubscriptionService } from './subscription.service';

describe('SubscriptionService.expireOverdue', () => {
  let service: SubscriptionService;
  let prisma: {
    subscription: { findMany: jest.Mock; update: jest.Mock };
  };
  let auditLog: { log: jest.Mock };

  beforeEach(async () => {
    prisma = {
      subscription: { findMany: jest.fn(), update: jest.fn() },
    };
    auditLog = { log: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = moduleRef.get(SubscriptionService);
  });

  it('queries only TRIAL/ACTIVE/PAST_DUE subscriptions whose expiresAt has passed', async () => {
    prisma.subscription.findMany.mockResolvedValue([]);

    await service.expireOverdue();

    const where = prisma.subscription.findMany.mock.calls[0][0].where;
    expect(where.expiresAt.lte).toBeInstanceOf(Date);
    expect(where.status.in.sort()).toEqual(
      [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE, SubscriptionStatus.TRIAL].sort(),
    );
  });

  it('flips every overdue subscription to EXPIRED', async () => {
    prisma.subscription.findMany.mockResolvedValue([
      {
        id: 'sub-1',
        tenantId: 't1',
        status: SubscriptionStatus.ACTIVE,
        expiresAt: new Date('2020-01-01'),
      },
      {
        id: 'sub-2',
        tenantId: 't2',
        status: SubscriptionStatus.TRIAL,
        expiresAt: new Date('2020-01-01'),
      },
    ]);

    const count = await service.expireOverdue();

    expect(count).toBe(2);
    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: { status: SubscriptionStatus.EXPIRED },
    });
    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-2' },
      data: { status: SubscriptionStatus.EXPIRED },
    });
  });

  it('audits each expiry with a null actor and the tenant it belongs to', async () => {
    prisma.subscription.findMany.mockResolvedValue([
      {
        id: 'sub-1',
        tenantId: 't1',
        status: SubscriptionStatus.ACTIVE,
        expiresAt: new Date('2020-01-01'),
      },
    ]);

    await service.expireOverdue();

    expect(auditLog.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: null,
        tenantId: 't1',
        action: 'SUBSCRIPTION_EXPIRED',
        resourceId: 'sub-1',
      }),
    );
  });

  it('does nothing when no subscription is overdue', async () => {
    prisma.subscription.findMany.mockResolvedValue([]);

    const count = await service.expireOverdue();

    expect(count).toBe(0);
    expect(prisma.subscription.update).not.toHaveBeenCalled();
    expect(auditLog.log).not.toHaveBeenCalled();
  });
});
