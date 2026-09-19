import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContactSubmissionStatus } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateContactSubmissionDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) name!: string;
  @ApiProperty() @IsEmail() @MaxLength(320) email!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(50) phone?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(200) company?: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) subject!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(5_000) message!: string;

  @ApiPropertyOptional({
    description: 'Must arrive empty. A hidden form field real users never see or fill.',
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  honeypot?: string;

  @ApiPropertyOptional({ description: 'ISO timestamp captured when the form first rendered.' })
  @IsString()
  @IsOptional()
  formLoadedAt?: string;
}

export class UpdateContactSubmissionStatusDto {
  @ApiProperty({ enum: ContactSubmissionStatus })
  @IsEnum(ContactSubmissionStatus)
  status!: ContactSubmissionStatus;
}

export class ContactSubmissionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() email!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) phone?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) company?: string | null;
  @ApiProperty() subject!: string;
  @ApiProperty() message!: string;
  @ApiProperty({ enum: ContactSubmissionStatus }) status!: ContactSubmissionStatus;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
