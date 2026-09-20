import { Injectable } from '@nestjs/common';
import { SubscriptionStatus, TenantStatus } from '@prisma/client';

export type AccessDecision =
  | { allowed: true }
  | {
      allowed: false;
      reason: 'tenant_not_active' | 'no_subscription' | 'subscription_inactive' | 'not_published';
    };

/**
 * Whether a tenant's public website may currently be served - the one place this decision
 * is made, so the rule never drifts between the public endpoint and anything else that
 * later needs the same check (an admin preview, a billing-triggered takedown, ...).
 *
 * Business rules straight from the spec's "Subscription Enforcement" section, plus the
 * client's own publish switch:
 *   Tenant.status must be ACTIVE (PENDING/SUSPENDED/ARCHIVED all block).
 *   Subscription.status TRIAL/ACTIVE/PAST_DUE -> full access (PAST_DUE is a grace period).
 *   Subscription.status EXPIRED/SUSPENDED/CANCELLED -> blocked.
 *   Tenant.isPublished must be true - the client's own "is my profile live" switch, distinct
 *   from (and in addition to) the admin-controlled status above.
 */
@Injectable()
export class TenantAccessService {
  private static readonly ACCESSIBLE_SUBSCRIPTION_STATUSES: ReadonlySet<SubscriptionStatus> =
    new Set([SubscriptionStatus.TRIAL, SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE]);

  isPubliclyAccessible(
    tenantStatus: TenantStatus,
    subscriptionStatus: SubscriptionStatus | null,
    isPublished: boolean,
  ): AccessDecision {
    if (tenantStatus !== TenantStatus.ACTIVE) {
      return { allowed: false, reason: 'tenant_not_active' };
    }
    if (!subscriptionStatus) {
      return { allowed: false, reason: 'no_subscription' };
    }
    if (!TenantAccessService.ACCESSIBLE_SUBSCRIPTION_STATUSES.has(subscriptionStatus)) {
      return { allowed: false, reason: 'subscription_inactive' };
    }
    if (!isPublished) {
      // Same 404 treatment as every other reason - a client who unpublishes their own
      // profile should be indistinguishable from a slug that never existed.
      return { allowed: false, reason: 'not_published' };
    }
    return { allowed: true };
  }
}
