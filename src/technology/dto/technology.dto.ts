import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PartialType } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateTechnologyDto {
  @ApiProperty({ example: 'Angular', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;
}

export class UpdateTechnologyDto extends PartialType(CreateTechnologyDto) {}

export class TechnologyResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ description: 'Normalised matching key used to prevent duplicates' })
  slug!: string;
  @ApiPropertyOptional({ description: 'Number of experiences referencing this technology' })
  experienceCount?: number;
  @ApiPropertyOptional({ description: 'Number of projects referencing this technology' })
  projectCount?: number;
}

export class AttachTechnologyDto {
  @ApiProperty({
    description:
      'Technology name. Resolved against the normalised slug and created only if no ' +
      'matching technology exists, so attaching never duplicates a technology record.',
    example: 'TypeScript',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ description: 'Display position; appended to the end when omitted' })
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}
