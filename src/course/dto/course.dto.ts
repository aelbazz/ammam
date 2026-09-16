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

export class CreateCourseDto {
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(64) legacyId?: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(300) title!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(300) provider!: string;

  @ApiProperty({ example: '2025', description: 'Free-text date. Not parsed.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  completionDate!: string;

  @ApiPropertyOptional({ description: 'Free text (e.g. "Beginner", "Diploma"). Not an enum.' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  level?: string;

  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(5000) description?: string;

  @ApiPropertyOptional({ type: [String], description: 'Course topics. Ordered; not technologies.' })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(100)
  @IsOptional()
  skills?: string[];

  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(50) duration?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(200) instructor?: string;
  @ApiPropertyOptional()
  @IsUrl({ require_protocol: true })
  @IsOptional()
  @MaxLength(500)
  courseUrl?: string;
  @ApiPropertyOptional()
  @IsUrl({ require_protocol: true })
  @IsOptional()
  @MaxLength(500)
  certificateUrl?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(50) startDate?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(50) grade?: string;
  @ApiPropertyOptional() @IsInt() @Min(0) @IsOptional() sortOrder?: number;
  @ApiPropertyOptional({ default: true }) @IsBoolean() @IsOptional() isPublished?: boolean;
}

export class UpdateCourseDto extends PartialType(CreateCourseDto) {}

export class CourseResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() legacyId!: string;
  @ApiProperty() title!: string;
  @ApiProperty() provider!: string;
  @ApiProperty() completionDate!: string;
  @ApiProperty({ type: String, nullable: true }) level!: string | null;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({ type: [String] }) skills!: string[];
  @ApiProperty({ type: String, nullable: true }) duration!: string | null;
  @ApiProperty({ type: String, nullable: true }) instructor!: string | null;
  @ApiProperty({ type: String, nullable: true }) courseUrl!: string | null;
  @ApiProperty({ type: String, nullable: true }) certificateUrl!: string | null;
  @ApiProperty({ type: String, nullable: true }) startDate!: string | null;
  @ApiProperty({ type: String, nullable: true }) grade!: string | null;
  @ApiProperty() sortOrder!: number;
  @ApiProperty() isPublished!: boolean;
}
