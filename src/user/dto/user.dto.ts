import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role, UserStatus } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCoordinatorDto {
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty({ minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(200) name?: string;
}

/** Distinct from CreateCoordinatorDto only in intent (who it creates) - kept separate so
 *  the two operations can diverge later (e.g. admin invites requiring 2FA) without a
 *  shared DTO forcing them to stay identical. */
export class CreateAdminDto {
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty({ minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(200) name?: string;
}

export class UpdateUserStatusDto {
  @ApiProperty({ enum: UserStatus })
  @IsEnum(UserStatus)
  status!: UserStatus;
}

export class UserResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) name?: string | null;
  @ApiProperty({ enum: Role }) role!: Role;
  @ApiProperty({ enum: UserStatus }) status!: UserStatus;
  @ApiPropertyOptional({ type: String, nullable: true }) tenantId?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) lastLoginAt?: Date | null;
  @ApiProperty() createdAt!: Date;
}
