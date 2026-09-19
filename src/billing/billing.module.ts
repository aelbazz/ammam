import { Module } from '@nestjs/common';
import { PlanService } from './plan.service';
import { SubscriptionService } from './subscription.service';
import { PaymentService } from './payment.service';
import { SubscriptionExpiryJob } from './subscription-expiry.job';
import { AdminBillingController } from './admin-billing.controller';
import { TenantBillingController } from './tenant-billing.controller';

@Module({
  controllers: [AdminBillingController, TenantBillingController],
  providers: [PlanService, SubscriptionService, PaymentService, SubscriptionExpiryJob],
  exports: [PlanService, SubscriptionService, PaymentService],
})
export class BillingModule {}
