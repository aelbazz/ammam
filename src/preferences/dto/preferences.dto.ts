import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UpdatePreferencesDto {
  @ApiProperty({
    description: 'Validated against the theme-mode registry - see GET /design-registry.',
  })
  @IsString()
  themeMode!: string;
}

export class PreferencesResponseDto {
  @ApiProperty() themeMode!: string;
}
