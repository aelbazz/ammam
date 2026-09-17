import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillingInterval, PaymentStatus, SubscriptionStatus } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreatePlanDto {
  @ApiProperty() @IsString() name!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
  @ApiProperty() @IsNumber() @Min(0) price!: number;
  @ApiPropertyOptional({ default: 'USD' }) @IsString() @IsOptional() currency?: string;
  @ApiProperty({ enum: BillingInterval })
  @IsEnum(BillingInterval)
  billingInterval!: BillingInterval;
  @ApiPropertyOptional({ default: true }) @IsBoolean() @IsOptional() active?: boolean;
  @ApiPropertyOptional({ type: [String] }) @IsArray() @IsOptional() features?: string[];
}

export class UpdatePlanDto {
  @ApiPropertyOptional() @IsString() @IsOptional() name?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
  @ApiPropertyOptional() @IsNumber() @Min(0) @IsOptional() price?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() currency?: string;
  @ApiPropertyOptional({ enum: BillingInterval })
  @IsEnum(BillingInterval)
  @IsOptional()
  billingInterval?: BillingInterval;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() active?: boolean;
  @ApiPropertyOptional({ type: [String] }) @IsArray() @IsOptional() features?: string[];
}

export class PlanResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) description?: string | null;
  @ApiProperty() price!: string;
  @ApiProperty() currency!: string;
  @ApiProperty({ enum: BillingInterval }) billingInterval!: BillingInterval;
  @ApiProperty() active!: boolean;
  @ApiProperty({ type: [String] }) features!: string[];
}

export class UpdateSubscriptionDto {
  @ApiPropertyOptional({ enum: SubscriptionStatus })
  @IsEnum(SubscriptionStatus)
  @IsOptional()
  status?: SubscriptionStatus;
  @ApiPropertyOptional() @IsString() @IsOptional() planId?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() expiresAt?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() renewalDate?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() autoRenew?: boolean;
}

export class SubscriptionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() tenantId!: string;
  @ApiPropertyOptional() tenantSlug?: string;
  @ApiPropertyOptional() tenantName?: string;
  @ApiProperty() planId!: string;
  @ApiPropertyOptional() planName?: string;
  @ApiProperty({ enum: SubscriptionStatus }) status!: SubscriptionStatus;
  @ApiProperty() startedAt!: Date;
  @ApiPropertyOptional({ type: Date, nullable: true }) expiresAt?: Date | null;
  @ApiPropertyOptional({ type: Date, nullable: true }) renewalDate?: Date | null;
  @ApiProperty() autoRenew!: boolean;
  @ApiPropertyOptional() daysRemaining?: number | null;
}

export class CreatePaymentDto {
  @ApiProperty() @IsString() tenantId!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() subscriptionId?: string;
  @ApiProperty() @IsNumber() @Min(0) amount!: number;
  @ApiPropertyOptional({ default: 'USD' }) @IsString() @IsOptional() currency?: string;
  @ApiPropertyOptional({ enum: PaymentStatus, default: PaymentStatus.PAID })
  @IsEnum(PaymentStatus)
  @IsOptional()
  status?: PaymentStatus;
  @ApiPropertyOptional({ default: 'manual' }) @IsString() @IsOptional() provider?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() providerTransactionId?: string;
}

export class PaymentResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() tenantId!: string;
  @ApiPropertyOptional() tenantSlug?: string;
  @ApiPropertyOptional({ type: String, nullable: true }) subscriptionId?: string | null;
  @ApiProperty() amount!: string;
  @ApiProperty() currency!: string;
  @ApiProperty({ enum: PaymentStatus }) status!: PaymentStatus;
  @ApiProperty() provider!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) providerTransactionId?: string | null;
  @ApiPropertyOptional({ type: Date, nullable: true }) paidAt?: Date | null;
  @ApiProperty() createdAt!: Date;
}
