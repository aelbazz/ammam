import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class CvSectionConfigEntryDto {
  @ApiProperty({ description: 'Validated against the CV section registry.' })
  @IsString()
  key!: string;

  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;
}

export class CreateCvVersionDto {
  @ApiProperty() @IsString() @MaxLength(200) name!: string;

  @ApiPropertyOptional({ description: 'Validated against the CV template registry.' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  templateId?: string;

  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(300) cvTitle?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(5000) cvSummary?: string;

  @ApiPropertyOptional() @IsBoolean() @IsOptional() includePhone?: boolean;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() includeEmail?: boolean;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() includeLinkedin?: boolean;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() includeGithub?: boolean;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() includePortfolio?: boolean;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() includeManagement?: boolean;

  @ApiPropertyOptional({ type: [CvSectionConfigEntryDto] })
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CvSectionConfigEntryDto)
  @IsOptional()
  sectionConfig?: CvSectionConfigEntryDto[];

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  @IsOptional()
  excludedExperienceIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  @IsOptional()
  excludedProjectIds?: string[];
}

export class UpdateCvVersionDto extends PartialType(CreateCvVersionDto) {}

export class CvVersionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() isDefault!: boolean;
  @ApiProperty() templateId!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) cvTitle!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) cvSummary!: string | null;
  @ApiProperty() includePhone!: boolean;
  @ApiProperty() includeEmail!: boolean;
  @ApiProperty() includeLinkedin!: boolean;
  @ApiProperty() includeGithub!: boolean;
  @ApiProperty() includePortfolio!: boolean;
  @ApiProperty() includeManagement!: boolean;
  @ApiProperty({ type: [CvSectionConfigEntryDto] }) sectionConfig!: CvSectionConfigEntryDto[];
  @ApiProperty({ type: [String] }) excludedExperienceIds!: string[];
  @ApiProperty({ type: [String] }) excludedProjectIds!: string[];
}

export class CvVersionSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() isDefault!: boolean;
  @ApiProperty() templateId!: string;
}
