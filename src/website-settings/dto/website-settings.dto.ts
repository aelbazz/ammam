import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateWebsiteSettingsDto {
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(200) websiteTitle?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(500) description?: string;
  @ApiPropertyOptional() @IsUrl({ require_protocol: true }) @IsOptional() faviconUrl?: string;
  @ApiPropertyOptional() @IsUrl({ require_protocol: true }) @IsOptional() logoUrl?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @IsOptional()
  visibleSections?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @IsOptional()
  sectionOrder?: string[];

  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(200) seoTitle?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(500) seoDescription?: string;
  @ApiPropertyOptional() @IsUrl({ require_protocol: true }) @IsOptional() ogImageUrl?: string;
}

export class WebsiteSettingsResponseDto {
  @ApiProperty() websiteTitle!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) description?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) faviconUrl?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) logoUrl?: string | null;
  @ApiProperty({ type: [String] }) visibleSections!: string[];
  @ApiProperty({ type: [String] }) sectionOrder!: string[];
  @ApiPropertyOptional({ type: String, nullable: true }) seoTitle?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) seoDescription?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) ogImageUrl?: string | null;
}
