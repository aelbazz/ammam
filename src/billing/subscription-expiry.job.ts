import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SubscriptionService } from './subscription.service';

/**
 * Thin scheduling wrapper - all the actual logic lives in
 * SubscriptionService.expireOverdue(), which is also reachable directly via
 * POST /admin/subscriptions/expire-overdue and is what's unit/e2e tested. This class exists
 * only to attach the @Cron trigger, so it stays untested itself (there is nothing here to
 * assert beyond "does it call the method", which the DI wiring already guarantees).
 */
@Injectable()
export class SubscriptionExpiryJob {
  constructor(private readonly subscriptions: SubscriptionService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCron(): Promise<void> {
    await this.subscriptions.expireOverdue();
  }
}
