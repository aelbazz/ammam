import { SubscriptionStatus, TenantStatus } from '@prisma/client';
import { TenantAccessService } from './tenant-access.service';

describe('TenantAccessService', () => {
  const service = new TenantAccessService();

  it.each([
    [TenantStatus.PENDING, null, 'tenant_not_active'],
    [TenantStatus.SUSPENDED, SubscriptionStatus.ACTIVE, 'tenant_not_active'],
    [TenantStatus.ARCHIVED, SubscriptionStatus.ACTIVE, 'tenant_not_active'],
    [TenantStatus.ACTIVE, null, 'no_subscription'],
    [TenantStatus.ACTIVE, SubscriptionStatus.EXPIRED, 'subscription_inactive'],
    [TenantStatus.ACTIVE, SubscriptionStatus.SUSPENDED, 'subscription_inactive'],
    [TenantStatus.ACTIVE, SubscriptionStatus.CANCELLED, 'subscription_inactive'],
  ])('blocks tenant=%s subscription=%s (%s)', (tenantStatus, subStatus, reason) => {
    const decision = service.isPubliclyAccessible(tenantStatus, subStatus, true);
    expect(decision.allowed).toBe(false);
    expect(decision.allowed === false && decision.reason).toBe(reason);
  });

  it.each([
    [TenantStatus.ACTIVE, SubscriptionStatus.TRIAL],
    [TenantStatus.ACTIVE, SubscriptionStatus.ACTIVE],
    [TenantStatus.ACTIVE, SubscriptionStatus.PAST_DUE],
  ])('allows tenant=%s subscription=%s (PAST_DUE is a grace period)', (tenantStatus, subStatus) => {
    expect(service.isPubliclyAccessible(tenantStatus, subStatus, true)).toEqual({ allowed: true });
  });

  it('blocks an active, subscribed tenant that has unpublished their own profile', () => {
    const decision = service.isPubliclyAccessible(
      TenantStatus.ACTIVE,
      SubscriptionStatus.ACTIVE,
      false,
    );
    expect(decision).toEqual({ allowed: false, reason: 'not_published' });
  });
});
