import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class SocialLinkDto {
  @ApiProperty({ example: 'LinkedIn' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  platform!: string;

  @ApiProperty() @IsUrl({ require_protocol: true }) @MaxLength(500) url!: string;

  @ApiPropertyOptional({ example: 'bi-linkedin' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  icon?: string;

  @ApiPropertyOptional() @IsInt() @Min(0) @IsOptional() sortOrder?: number;
}

export class UpsertContactDto {
  @ApiProperty() @IsEmail() @MaxLength(255) email!: string;
  @ApiProperty({ example: '+966548926532' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  phone!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(50) whatsapp!: string;
  @ApiProperty() @IsUrl({ require_protocol: true }) @MaxLength(500) linkedin!: string;

  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(200) location?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(50) birthday?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(500) muchskills?: string;

  @ApiPropertyOptional({ type: [SocialLinkDto], description: 'Replaces the whole list when sent' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SocialLinkDto)
  @IsOptional()
  socialLinks?: SocialLinkDto[];
}

export class UpdateContactDto extends PartialType(UpsertContactDto) {}

export class SocialLinkResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() platform!: string;
  @ApiProperty() url!: string;
  @ApiProperty({ type: String, nullable: true }) icon!: string | null;
  @ApiProperty() sortOrder!: number;
}

export class ContactResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() phone!: string;
  @ApiProperty() whatsapp!: string;
  @ApiProperty() linkedin!: string;
  @ApiProperty({ type: String, nullable: true }) location!: string | null;
  @ApiProperty({ type: String, nullable: true }) birthday!: string | null;
  @ApiProperty({ type: String, nullable: true }) muchskills!: string | null;
  @ApiProperty({ type: [SocialLinkResponseDto] }) socialLinks!: SocialLinkResponseDto[];
}
