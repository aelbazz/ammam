import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { AchievementCategory } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateAchievementDto {
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(64) legacyId?: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(300) title!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(5000) description!: string;

  @ApiProperty({ example: '2025', description: 'Free-text date. Not parsed.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  date!: string;

  @ApiProperty({ enum: AchievementCategory })
  @IsEnum(AchievementCategory)
  category!: AchievementCategory;

  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(200) organization?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(100) icon?: string;
  @ApiPropertyOptional()
  @IsUrl({ require_protocol: true })
  @IsOptional()
  @MaxLength(500)
  articleUrl?: string;
  @ApiPropertyOptional() @IsInt() @Min(0) @IsOptional() sortOrder?: number;
  @ApiPropertyOptional({ default: true }) @IsBoolean() @IsOptional() isPublished?: boolean;
}

export class UpdateAchievementDto extends PartialType(CreateAchievementDto) {}

export class AchievementResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() legacyId!: string;
  @ApiProperty() title!: string;
  @ApiProperty() description!: string;
  @ApiProperty() date!: string;
  @ApiProperty({ enum: AchievementCategory }) category!: AchievementCategory;
  @ApiProperty({ type: String, nullable: true }) organization!: string | null;
  @ApiProperty({ type: String, nullable: true }) icon!: string | null;
  @ApiProperty({ type: String, nullable: true }) articleUrl!: string | null;
  @ApiProperty() sortOrder!: number;
  @ApiProperty() isPublished!: boolean;
}
