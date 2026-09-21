import { Module } from '@nestjs/common';
import { CvController } from './cv.controller';
import { CvVersionService } from './cv-version.service';
import { CvBuilderService } from './cv-builder.service';
import { CvExportService } from './cv-export.service';
import { CvPdfGenerator } from './generators/cv-pdf.generator';
import { CvDocxGenerator } from './generators/cv-docx.generator';

@Module({
  controllers: [CvController],
  providers: [CvVersionService, CvBuilderService, CvExportService, CvPdfGenerator, CvDocxGenerator],
  exports: [CvVersionService, CvBuilderService, CvExportService],
})
export class CvModule {}
