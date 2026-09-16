import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ManagementLevel } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateManagementRoleDto {
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(64) legacyId?: string;

  @ApiProperty({
    enum: ManagementLevel,
    description:
      'Existing data contains high and medium; the frontend interface declares high|low.',
  })
  @IsEnum(ManagementLevel)
  level!: ManagementLevel;

  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(300) title!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(300) organization!: string;
  @ApiProperty({ example: 'Jan 2024' }) @IsString() @IsNotEmpty() @MaxLength(50) startDate!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  endDate?: string | null;

  @ApiProperty() @IsBoolean() isCurrent!: boolean;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(5000) description!: string;

  @ApiPropertyOptional() @IsInt() @Min(0) @IsOptional() teamSize?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(100)
  @IsOptional()
  keyResponsibilities?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(100)
  @IsOptional()
  achievements?: string[];

  @ApiPropertyOptional() @IsInt() @Min(0) @IsOptional() sortOrder?: number;
  @ApiPropertyOptional({ default: true }) @IsBoolean() @IsOptional() isPublished?: boolean;
}

export class UpdateManagementRoleDto extends PartialType(CreateManagementRoleDto) {}

export class ManagementChildResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() description!: string;
  @ApiProperty() sortOrder!: number;
}

export class ManagementRoleResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() legacyId!: string;
  @ApiProperty({ enum: ManagementLevel }) level!: ManagementLevel;
  @ApiProperty() title!: string;
  @ApiProperty() organization!: string;
  @ApiProperty() startDate!: string;
  @ApiProperty({ type: String, nullable: true }) endDate!: string | null;
  @ApiProperty() isCurrent!: boolean;
  @ApiProperty() description!: string;
  @ApiProperty({ type: Number, nullable: true }) teamSize!: number | null;
  @ApiProperty({ type: [ManagementChildResponseDto] })
  keyResponsibilities!: ManagementChildResponseDto[];
  @ApiProperty({ type: [ManagementChildResponseDto] }) achievements!: ManagementChildResponseDto[];
  @ApiProperty() sortOrder!: number;
  @ApiProperty() isPublished!: boolean;
}
