import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TenantStatus } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateTenantDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({
    example: 'jane-doe',
    description: 'Lowercase, URL-safe. Auto-generated from name when omitted.',
  })
  @IsString()
  @IsOptional()
  @MaxLength(63)
  @Matches(/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/, {
    message:
      'slug must be lowercase letters, digits and single hyphens, with no leading/trailing hyphen',
  })
  slug?: string;

  @ApiProperty({ example: 'jane@example.com', description: "The new tenant's CLIENT login" })
  @IsEmail()
  clientEmail!: string;

  @ApiProperty({ minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  clientPassword!: string;

  @ApiPropertyOptional({ description: 'Coordinator to assign immediately, if any' })
  @IsString()
  @IsOptional()
  coordinatorId?: string;

  @ApiPropertyOptional({ description: 'Plan id; falls back to the platform default plan' })
  @IsString()
  @IsOptional()
  planId?: string;
}

/** Used by POST /coordinator/tenants - a Coordinator cannot choose the coordinator or plan. */
export class CreateTenantAsCoordinatorDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ example: 'jane-doe' })
  @IsString()
  @IsOptional()
  @MaxLength(63)
  @Matches(/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/)
  slug?: string;

  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  clientEmail!: string;

  @ApiProperty({ minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  clientPassword!: string;
}

export class UpdateTenantDto {
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(200) name?: string;

  @ApiPropertyOptional({ description: 'Changing this adds the old slug to the redirect history' })
  @IsString()
  @IsOptional()
  @MaxLength(63)
  @Matches(/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/)
  slug?: string;
}

/** Coordinators may only touch the name - slug changes and reassignment are Admin-only. */
export class UpdateTenantAsCoordinatorDto {
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(200) name?: string;
}

export class UpdateTenantStatusDto {
  @ApiProperty({ enum: TenantStatus })
  @IsEnum(TenantStatus)
  status!: TenantStatus;
}

export class AssignCoordinatorDto {
  @ApiPropertyOptional({ description: 'Null to unassign' })
  @IsString()
  @IsOptional()
  coordinatorId?: string | null;
}

export class TenantResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: TenantStatus }) status!: TenantStatus;
  @ApiPropertyOptional({ type: String, nullable: true }) coordinatorId?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) coordinatorEmail?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) createdById?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) clientEmail?: string | null;
  @ApiPropertyOptional() subscriptionStatus?: string;
  @ApiPropertyOptional() planName?: string;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
