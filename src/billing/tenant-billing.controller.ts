import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { SubscriptionService } from './subscription.service';
import { PaymentService } from './payment.service';
import { PaymentResponseDto, SubscriptionResponseDto } from './dto/billing.dto';

/**
 * Read-only for the CLIENT. Nothing here accepts a write: plan, payment status and
 * subscription status are Admin/system-controlled, never client-editable - see
 * docs/SAAS-ARCHITECTURE.md "Subscription Security".
 */
@ApiTags('tenant')
@ApiBearerAuth()
@Roles(Role.CLIENT)
@Controller('tenant')
export class TenantBillingController {
  constructor(
    private readonly subscriptions: SubscriptionService,
    private readonly payments: PaymentService,
  ) {}

  @Get('subscription')
  @ApiOperation({ summary: 'View my own subscription' })
  @ApiResponse({ status: 200, type: SubscriptionResponseDto })
  getSubscription(@CurrentUser() user: AuthenticatedUser) {
    return this.subscriptions.findForTenant(user.tenantId!);
  }

  @Get('payments')
  @ApiOperation({ summary: 'View my own payment history' })
  @ApiResponse({ status: 200, type: [PaymentResponseDto] })
  getPayments(@CurrentUser() user: AuthenticatedUser) {
    return this.payments.findForTenant(user.tenantId!);
  }
}
