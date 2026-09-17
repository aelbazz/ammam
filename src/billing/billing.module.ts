import { Module } from '@nestjs/common';
import { PlanService } from './plan.service';
import { SubscriptionService } from './subscription.service';
import { PaymentService } from './payment.service';
import { AdminBillingController } from './admin-billing.controller';
import { TenantBillingController } from './tenant-billing.controller';

@Module({
  controllers: [AdminBillingController, TenantBillingController],
  providers: [PlanService, SubscriptionService, PaymentService],
  exports: [PlanService, SubscriptionService, PaymentService],
})
export class BillingModule {}
