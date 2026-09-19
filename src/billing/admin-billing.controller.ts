import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { PlanService } from './plan.service';
import { SubscriptionService } from './subscription.service';
import { PaymentService } from './payment.service';
import {
  CreatePaymentDto,
  CreatePlanDto,
  PaymentResponseDto,
  PlanResponseDto,
  SubscriptionResponseDto,
  UpdatePlanDto,
  UpdateSubscriptionDto,
} from './dto/billing.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminBillingController {
  constructor(
    private readonly plans: PlanService,
    private readonly subscriptions: SubscriptionService,
    private readonly payments: PaymentService,
  ) {}

  // -- plans --------------------------------------------------------------

  @Get('plans')
  @ApiOperation({ summary: 'List billing plans' })
  @ApiResponse({ status: 200, type: [PlanResponseDto] })
  listPlans() {
    return this.plans.findAll();
  }

  @Post('plans')
  @ApiOperation({ summary: 'Create a billing plan' })
  @ApiResponse({ status: 201, type: PlanResponseDto })
  createPlan(@Body() dto: CreatePlanDto) {
    return this.plans.create(dto);
  }

  @Patch('plans/:id')
  @ApiOperation({ summary: 'Update a billing plan' })
  @ApiResponse({ status: 200, type: PlanResponseDto })
  updatePlan(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.plans.update(id, dto);
  }

  // -- subscriptions --------------------------------------------------------

  @Get('subscriptions')
  @ApiOperation({
    summary: 'List subscriptions across every tenant',
    description: 'Who has paid, who has not, renewal dates - filterable by status/tenant/plan.',
  })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'planId', required: false })
  @ApiResponse({ status: 200, type: [SubscriptionResponseDto] })
  listSubscriptions(
    @Query('status') status?: string,
    @Query('tenantId') tenantId?: string,
    @Query('planId') planId?: string,
  ) {
    return this.subscriptions.findAllForAdmin({ status, tenantId, planId });
  }

  @Post('subscriptions/expire-overdue')
  @ApiOperation({
    summary: 'Expire every subscription whose expiresAt has passed',
    description:
      'Runs automatically once a day (SubscriptionExpiryJob); this lets an admin trigger it ' +
      'on demand instead of waiting for the next scheduled run.',
  })
  @ApiResponse({ status: 201, description: 'Number of subscriptions expired' })
  async expireOverdueSubscriptions(): Promise<{ expired: number }> {
    return { expired: await this.subscriptions.expireOverdue() };
  }

  @Patch('tenants/:tenantId/subscription')
  @ApiOperation({ summary: "Update a tenant's subscription (status, plan, renewal date)" })
  @ApiResponse({ status: 200, type: SubscriptionResponseDto })
  updateSubscription(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('tenantId') tenantId: string,
    @Body() dto: UpdateSubscriptionDto,
  ) {
    return this.subscriptions.update(actor, tenantId, dto);
  }

  // -- payments ---------------------------------------------------------------

  @Get('payments')
  @ApiOperation({ summary: 'List payment records' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiResponse({ status: 200, type: [PaymentResponseDto] })
  listPayments(@Query('tenantId') tenantId?: string) {
    return this.payments.findAll(tenantId);
  }

  @Post('payments')
  @ApiOperation({
    summary: 'Record a payment',
    description: 'provider defaults to "manual" until a real payment processor is integrated.',
  })
  @ApiResponse({ status: 201, type: PaymentResponseDto })
  recordPayment(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreatePaymentDto) {
    return this.payments.record(actor, dto);
  }
}
