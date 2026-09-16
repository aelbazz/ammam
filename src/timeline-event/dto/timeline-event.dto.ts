import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { TimelineEventType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateTimelineEventDto {
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(64) legacyId?: string;

  @ApiProperty({
    example: 'Feb 2025',
    description: 'Free-text date. Display order comes from sortOrder.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  date!: string;

  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(300) title!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(300) subtitle?: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(5000) description!: string;

  @ApiProperty({ enum: TimelineEventType })
  @IsEnum(TimelineEventType)
  type!: TimelineEventType;

  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(100) icon?: string;
  @ApiPropertyOptional() @IsInt() @Min(0) @IsOptional() sortOrder?: number;
  @ApiPropertyOptional({ default: true }) @IsBoolean() @IsOptional() isPublished?: boolean;
}

export class UpdateTimelineEventDto extends PartialType(CreateTimelineEventDto) {}

export class TimelineEventResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() legacyId!: string;
  @ApiProperty() date!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ type: String, nullable: true }) subtitle!: string | null;
  @ApiProperty() description!: string;
  @ApiProperty({ enum: TimelineEventType }) type!: TimelineEventType;
  @ApiProperty({ type: String, nullable: true }) icon!: string | null;
  @ApiProperty() sortOrder!: number;
  @ApiProperty() isPublished!: boolean;
}
