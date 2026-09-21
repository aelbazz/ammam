import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class CvDownloadQueryDto {
  @ApiProperty({ enum: ['pdf', 'docx'] })
  @IsIn(['pdf', 'docx'])
  format!: 'pdf' | 'docx';
}
