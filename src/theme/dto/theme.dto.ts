import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsHexColor, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateThemeDto {
  @ApiPropertyOptional() @IsHexColor() @IsOptional() primaryColor?: string;
  @ApiPropertyOptional() @IsHexColor() @IsOptional() secondaryColor?: string;
  @ApiPropertyOptional() @IsHexColor() @IsOptional() accentColor?: string;
  @ApiPropertyOptional() @IsHexColor() @IsOptional() backgroundColor?: string;
  @ApiPropertyOptional() @IsHexColor() @IsOptional() textColor?: string;
  @ApiPropertyOptional() @IsHexColor() @IsOptional() headingColor?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(200) fontFamily?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(20) borderRadius?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(50) layout?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() darkMode?: boolean;
  @ApiPropertyOptional({
    description:
      'Rendered by the frontend inside a scoped <style> tag, never evaluated as script. ' +
      'Capped at 20 KB.',
  })
  @IsString()
  @IsOptional()
  @MaxLength(20_000)
  customCss?: string;
}

export class ThemeResponseDto {
  @ApiProperty() primaryColor!: string;
  @ApiProperty() secondaryColor!: string;
  @ApiProperty() accentColor!: string;
  @ApiProperty() backgroundColor!: string;
  @ApiProperty() textColor!: string;
  @ApiProperty() headingColor!: string;
  @ApiProperty() fontFamily!: string;
  @ApiProperty() borderRadius!: string;
  @ApiProperty() layout!: string;
  @ApiProperty() darkMode!: boolean;
  @ApiPropertyOptional({ type: String, nullable: true }) customCss?: string | null;
}
