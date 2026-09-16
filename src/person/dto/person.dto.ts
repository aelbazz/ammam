import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePersonDto {
  @ApiProperty({ example: 'Ahmed Mohsen Albaz' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiProperty({ example: 'Staff Engineer / Frontend Technical Lead' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title!: string;

  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(5000) summary!: string;
  @ApiProperty({ example: 'Riyadh, Saudi Arabia' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  location!: string;

  @ApiProperty({ minimum: 0, maximum: 80 })
  @IsInt()
  @Min(0)
  @Max(80)
  yearsOfExperience!: number;

  @ApiProperty({ description: 'Frontend-relative asset path, stored verbatim' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  avatar!: string;

  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(500) tagline!: string;

  @ApiPropertyOptional()
  @IsUrl({ require_protocol: true })
  @IsOptional()
  @MaxLength(500)
  linkedin?: string;

  @ApiPropertyOptional({ example: 'June 26', description: 'Free text, matching existing data' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  birthday?: string;
}

export class UpdatePersonDto extends PartialType(CreatePersonDto) {}

export class PersonResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() title!: string;
  @ApiProperty() summary!: string;
  @ApiProperty() location!: string;
  @ApiProperty() yearsOfExperience!: number;
  @ApiProperty() avatar!: string;
  @ApiProperty() tagline!: string;
  @ApiProperty({ type: String, nullable: true }) linkedin!: string | null;
  @ApiProperty({ type: String, nullable: true }) birthday!: string | null;
}
