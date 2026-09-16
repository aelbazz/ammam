import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
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
} from 'class-validator';

export class CreateProjectDto {
  @ApiPropertyOptional({
    description: 'Stable public id, e.g. "proj17". Auto-generated if omitted.',
  })
  @IsString()
  @IsOptional()
  @MaxLength(64)
  legacyId?: string;

  @ApiProperty({ example: 'iHealth' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  name!: string;

  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(5000) description!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(300) role!: string;

  @ApiProperty({ example: '2024', description: 'Free-text date. Not parsed.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  startDate!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  endDate?: string | null;

  @ApiPropertyOptional({ description: 'Free text, e.g. "Government Platform". Not an enum.' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  type?: string;

  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(200) company?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(100)
  @IsOptional()
  highlights?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Existing technologies are reused.' })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(100)
  @IsOptional()
  technologies?: string[];

  @ApiPropertyOptional()
  @IsUrl({ require_protocol: true })
  @IsOptional()
  @MaxLength(500)
  imageUrl?: string;
  @ApiPropertyOptional()
  @IsUrl({ require_protocol: true })
  @IsOptional()
  @MaxLength(500)
  githubUrl?: string;
  @ApiPropertyOptional()
  @IsUrl({ require_protocol: true })
  @IsOptional()
  @MaxLength(500)
  liveUrl?: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isStrategicInitiative?: boolean;
  @ApiPropertyOptional({ default: false }) @IsBoolean() @IsOptional() isCurrent?: boolean;
  @ApiPropertyOptional() @IsInt() @Min(0) @IsOptional() sortOrder?: number;
  @ApiPropertyOptional({ default: true }) @IsBoolean() @IsOptional() isPublished?: boolean;
}

export class UpdateProjectDto extends PartialType(CreateProjectDto) {}

export class ProjectHighlightResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() description!: string;
  @ApiProperty() sortOrder!: number;
}

export class ProjectResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() legacyId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() description!: string;
  @ApiProperty() role!: string;
  @ApiProperty() startDate!: string;
  @ApiProperty({ type: String, nullable: true }) endDate!: string | null;
  @ApiProperty({ type: String, nullable: true }) type!: string | null;
  @ApiProperty({ type: String, nullable: true }) company!: string | null;
  @ApiProperty({ type: [ProjectHighlightResponseDto] }) highlights!: ProjectHighlightResponseDto[];
  @ApiProperty({ type: [String] }) technologies!: string[];
  @ApiProperty({ type: String, nullable: true }) imageUrl!: string | null;
  @ApiProperty({ type: String, nullable: true }) githubUrl!: string | null;
  @ApiProperty({ type: String, nullable: true }) liveUrl!: string | null;
  @ApiProperty() isStrategicInitiative!: boolean;
  @ApiProperty() isCurrent!: boolean;
  @ApiProperty() sortOrder!: number;
  @ApiProperty() isPublished!: boolean;
}
