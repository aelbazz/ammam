import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsBoolean, IsInt, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateSectionDto {
  @ApiProperty({ description: 'Whether this section shows on the public site' })
  @IsBoolean()
  enabled!: boolean;
}

export class SectionOrderEntryDto {
  @ApiProperty() @IsString() sectionKey!: string;
  @ApiProperty() @IsInt() @Min(1) displayOrder!: number;
}

export class ReorderSectionsDto {
  @ApiProperty({ type: [SectionOrderEntryDto] })
  @ValidateNested({ each: true })
  @Type(() => SectionOrderEntryDto)
  @ArrayMinSize(1)
  sections!: SectionOrderEntryDto[];
}

export class SectionResponseDto {
  @ApiProperty() sectionKey!: string;
  @ApiProperty({ description: 'One clear label for the control panel - "Show on my site".' })
  label!: string;
  @ApiProperty() enabled!: boolean;
  @ApiProperty() displayOrder!: number;
  @ApiProperty({ description: 'Live count of published items in this section' })
  itemCount!: number;
}
