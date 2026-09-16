import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateExperienceDto {
  @ApiPropertyOptional({
    description:
      'Stable public id, e.g. "exp10". Auto-generated from the name when omitted. The ' +
      'frontend uses this for tracking and anchors.',
  })
  @IsString()
  @IsOptional()
  @MaxLength(64)
  legacyId?: string;

  @ApiProperty({ example: 'THIQAH' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  company!: string;

  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(300) companyFullName?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(500) companyLogo?: string;

  @ApiPropertyOptional()
  @IsUrl({ require_protocol: true })
  @IsOptional()
  @MaxLength(500)
  companyWebsite?: string;

  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(5000) companyDescription?: string;

  @ApiProperty({ example: 'Staff Developer' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  position!: string;

  @ApiProperty({ example: 'Riyadh, Saudi Arabia' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  location!: string;

  @ApiProperty({
    example: 'Jan 2024',
    description: 'Free-text date, matching the existing data format. Not parsed.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  startDate!: string;

  @ApiPropertyOptional({ example: 'Dec 2025', nullable: true })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  endDate?: string | null;

  @ApiProperty() @IsBoolean() isCurrent!: boolean;

  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(5000) description!: string;

  @ApiPropertyOptional({ type: [String], description: 'Ordered; array position becomes sortOrder' })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(100)
  @IsOptional()
  responsibilities?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(100)
  @IsOptional()
  achievements?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Technology names. Existing technologies are reused, never duplicated.',
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(100)
  @IsOptional()
  technologies?: string[];

  @ApiPropertyOptional() @IsInt() @Min(0) @IsOptional() sortOrder?: number;
  @ApiPropertyOptional({ default: true }) @IsBoolean() @IsOptional() isPublished?: boolean;
}

export class UpdateExperienceDto extends PartialType(CreateExperienceDto) {}

export class ReorderItemDto {
  @ApiProperty() @IsString() @IsNotEmpty() id!: string;
  @ApiProperty() @IsInt() @Min(0) sortOrder!: number;
}

export class ReorderDto {
  @ApiProperty({ type: [ReorderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items!: ReorderItemDto[];
}

export class CreateChildItemDto {
  @ApiProperty({ description: 'The responsibility or achievement text' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description!: string;

  @ApiPropertyOptional({ description: 'Appended to the end when omitted' })
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}

export class UpdateChildItemDto extends PartialType(CreateChildItemDto) {}

export class ChildItemResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() description!: string;
  @ApiProperty() sortOrder!: number;
}

export class ExperienceResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ description: 'Public id used by the frontend, e.g. "exp1"' }) legacyId!: string;
  @ApiProperty() company!: string;
  @ApiProperty({ type: String, nullable: true }) companyFullName!: string | null;
  @ApiProperty({ type: String, nullable: true }) companyLogo!: string | null;
  @ApiProperty({ type: String, nullable: true }) companyWebsite!: string | null;
  @ApiProperty({ type: String, nullable: true }) companyDescription!: string | null;
  @ApiProperty() position!: string;
  @ApiProperty() location!: string;
  @ApiProperty() startDate!: string;
  @ApiProperty({ type: String, nullable: true }) endDate!: string | null;
  @ApiProperty() isCurrent!: boolean;
  @ApiProperty() description!: string;
  @ApiProperty({ type: [ChildItemResponseDto] }) responsibilities!: ChildItemResponseDto[];
  @ApiProperty({ type: [ChildItemResponseDto] }) achievements!: ChildItemResponseDto[];
  @ApiProperty({ type: [String] }) technologies!: string[];
  @ApiProperty() sortOrder!: number;
  @ApiProperty() isPublished!: boolean;
}
