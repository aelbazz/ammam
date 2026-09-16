import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateSkillCategoryDto {
  @ApiProperty({ example: 'Frontend Technologies' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional() @IsInt() @Min(0) @IsOptional() sortOrder?: number;
  @ApiPropertyOptional({ default: true }) @IsBoolean() @IsOptional() isPublished?: boolean;
}

export class UpdateSkillCategoryDto extends PartialType(CreateSkillCategoryDto) {}

export class CreateSkillDto {
  @ApiProperty({ example: 'Angular' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiProperty({
    minimum: 0,
    maximum: 9,
    description: '0 means unranked and renders as a grey no-rank tag - not the same as level 1.',
  })
  @IsInt()
  @Min(0)
  @Max(9)
  level!: number;

  @ApiPropertyOptional({ description: 'Year first used, e.g. 2012' })
  @IsInt()
  @Min(1900)
  @Max(2200)
  @IsOptional()
  since?: number;

  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(100) icon?: string;
  @ApiPropertyOptional() @IsInt() @Min(0) @Max(80) @IsOptional() yearsOfExperience?: number;
  @ApiPropertyOptional() @IsInt() @Min(0) @IsOptional() endorsements?: number;
  @ApiPropertyOptional() @IsInt() @Min(0) @IsOptional() sortOrder?: number;
}

export class UpdateSkillDto extends PartialType(CreateSkillDto) {}

export class SkillResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() level!: number;
  @ApiProperty() category!: string;
  @ApiProperty({ type: Number, nullable: true }) since!: number | null;
  @ApiProperty({ type: String, nullable: true }) icon!: string | null;
  @ApiProperty({ type: Number, nullable: true }) yearsOfExperience!: number | null;
  @ApiProperty({ type: Number, nullable: true }) endorsements!: number | null;
  @ApiProperty() sortOrder!: number;
}

export class SkillCategoryResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: [SkillResponseDto] }) skills!: SkillResponseDto[];
  @ApiProperty() sortOrder!: number;
  @ApiProperty() isPublished!: boolean;
}
