import { Injectable } from '@nestjs/common';
import { CvVersionService } from './cv-version.service';
import { CvBuilderService } from './cv-builder.service';
import { CvPdfGenerator } from './generators/cv-pdf.generator';
import { CvDocxGenerator } from './generators/cv-docx.generator';
import { sanitizeForFilename } from './cv-filename.util';

export interface GeneratedCvFile {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

const MIME_TYPES = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
} as const;

/**
 * Orchestrates one CV version's full generation: load the version -> build the normalized
 * CvDocument (CvBuilderService, the single mapping authority) -> render it with the
 * requested format's generator. Every download (authenticated or public) goes through this
 * one method, so the two surfaces can never diverge in behavior.
 */
@Injectable()
export class CvExportService {
  constructor(
    private readonly versions: CvVersionService,
    private readonly builder: CvBuilderService,
    private readonly pdf: CvPdfGenerator,
    private readonly docx: CvDocxGenerator,
  ) {}

  async generate(
    personId: string,
    versionId: string,
    format: 'pdf' | 'docx',
  ): Promise<GeneratedCvFile> {
    const version = await this.versions.findOneOrThrow(personId, versionId);
    const document = await this.builder.build(personId, version);
    const buffer =
      format === 'pdf' ? await this.pdf.generate(document) : await this.docx.generate(document);

    return {
      buffer,
      filename: `${sanitizeForFilename(document.header.fullName)}-CV.${format}`,
      mimeType: MIME_TYPES[format],
    };
  }
}
