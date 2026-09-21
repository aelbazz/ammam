import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { CvDocument } from '../cv-document.model';
import { cvSectionHeading } from '../cv-section-registry';

const PAGE_MARGIN = 56; // ~0.78in - standard ATS body margin
const BODY_FONT_SIZE = 10;
const HEADING_FONT_SIZE = 13;
const NAME_FONT_SIZE = 20;

/**
 * Renders a CvDocument as a single-column, real-text PDF via pdfkit - never a screenshot or
 * rasterized image. Base-14 fonts (Helvetica/Helvetica-Bold) need no embedding, guaranteeing
 * real, selectable, ATS-safe text - see cv-export.service.spec.ts for the automated proof
 * (extracting text back out of a generated PDF via pdf-parse).
 */
@Injectable()
export class CvPdfGenerator {
  async generate(cv: CvDocument): Promise<Buffer> {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN },
      bufferPages: true,
      info: {
        Title: cv.meta.title,
        Author: cv.meta.author,
        Subject: cv.meta.subject,
        Creator: cv.meta.creator,
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) =>
      doc.on('end', () => resolve(Buffer.concat(chunks))),
    );

    this.renderHeader(doc, cv);
    if (cv.summary) this.renderSummary(doc, cv.summary);

    for (const key of cv.sectionOrder) {
      this.avoidOrphanHeading(doc);
      doc
        .moveDown(0.75)
        .font('Helvetica-Bold')
        .fontSize(HEADING_FONT_SIZE)
        .text(cvSectionHeading(key));
      doc.moveDown(0.35).font('Helvetica').fontSize(BODY_FONT_SIZE);

      switch (key) {
        case 'experience':
          this.renderExperience(doc, cv);
          break;
        case 'skills':
          this.renderSkills(doc, cv);
          break;
        case 'projects':
          this.renderProjects(doc, cv);
          break;
        case 'education':
          this.renderEducation(doc, cv);
          break;
        case 'courses':
          this.renderCertifications(doc, cv);
          break;
        case 'achievements':
          this.renderAchievements(doc, cv);
          break;
        default:
          break;
      }
    }

    doc.end();
    return done;
  }

  private renderHeader(doc: PDFKit.PDFDocument, cv: CvDocument): void {
    doc.font('Helvetica-Bold').fontSize(NAME_FONT_SIZE).text(cv.header.fullName);
    doc.font('Helvetica').fontSize(12).text(cv.header.headline);

    const locationLine = cv.header.location ? [cv.header.location] : [];
    if (locationLine.length) {
      doc.moveDown(0.2).fontSize(BODY_FONT_SIZE).text(locationLine.join(' | '));
    }

    if (cv.header.contacts.length) {
      doc.moveDown(0.2).fontSize(BODY_FONT_SIZE);
      cv.header.contacts.forEach((contact, i) => {
        if (i > 0) doc.text('  |  ', { continued: true });
        doc.text(`${contact.label}: `, { continued: true, link: undefined });
        if (contact.href) {
          doc.fillColor('#0000EE').text(contact.value, {
            link: contact.href,
            underline: true,
            continued: i < cv.header.contacts.length - 1,
          });
          doc.fillColor('#000000');
        } else {
          doc.text(contact.value, { continued: i < cv.header.contacts.length - 1 });
        }
      });
      doc.text('');
    }
  }

  private renderSummary(doc: PDFKit.PDFDocument, summary: string): void {
    this.avoidOrphanHeading(doc);
    doc
      .moveDown(0.75)
      .font('Helvetica-Bold')
      .fontSize(HEADING_FONT_SIZE)
      .text('Professional Summary');
    doc.moveDown(0.35).font('Helvetica').fontSize(BODY_FONT_SIZE).text(summary, { align: 'left' });
  }

  private renderExperience(doc: PDFKit.PDFDocument, cv: CvDocument): void {
    for (const entry of cv.experience) {
      this.avoidOrphanHeading(doc, 90);
      doc.font('Helvetica-Bold').fontSize(11).text(entry.organization);
      doc.font('Helvetica-Oblique').fontSize(BODY_FONT_SIZE).text(entry.role);
      const meta = [entry.location, entry.dateRange].filter(Boolean).join(' | ');
      doc.font('Helvetica').fontSize(9).text(meta);
      doc.moveDown(0.2).font('Helvetica').fontSize(BODY_FONT_SIZE);
      if (entry.bullets.length) {
        doc.list(entry.bullets, { bulletRadius: 2, textIndent: 12 });
      }
      if (entry.technologies.length) {
        doc
          .moveDown(0.15)
          .font('Helvetica-Bold')
          .fontSize(9)
          .text('Technologies: ', { continued: true });
        doc.font('Helvetica').fontSize(9).text(entry.technologies.join(', '));
      }
      doc.moveDown(0.5);
    }
  }

  private renderSkills(doc: PDFKit.PDFDocument, cv: CvDocument): void {
    for (const group of cv.skills) {
      doc.font('Helvetica-Bold').text(`${group.category}: `, { continued: true });
      doc.font('Helvetica').text(group.skills.join(', '));
      doc.moveDown(0.2);
    }
  }

  private renderProjects(doc: PDFKit.PDFDocument, cv: CvDocument): void {
    for (const project of cv.projects) {
      this.avoidOrphanHeading(doc, 90);
      doc.font('Helvetica-Bold').fontSize(11).text(project.name);
      const meta = [project.role, project.dateRange].filter(Boolean).join(' | ');
      if (meta) doc.font('Helvetica').fontSize(9).text(meta);
      doc.moveDown(0.15).font('Helvetica').fontSize(BODY_FONT_SIZE).text(project.description);
      if (project.technologies.length) {
        doc
          .moveDown(0.15)
          .font('Helvetica-Bold')
          .fontSize(9)
          .text('Technologies: ', { continued: true });
        doc.font('Helvetica').fontSize(9).text(project.technologies.join(', '));
      }
      if (project.highlights.length) {
        doc.moveDown(0.15).font('Helvetica').fontSize(BODY_FONT_SIZE);
        doc.list(project.highlights, { bulletRadius: 2, textIndent: 12 });
      }
      const links = [
        project.githubUrl ? `GitHub: ${project.githubUrl}` : null,
        project.liveUrl ? `Live: ${project.liveUrl}` : null,
      ].filter((v): v is string => Boolean(v));
      if (links.length) doc.moveDown(0.1).fontSize(9).text(links.join('  |  '));
      doc.moveDown(0.5);
    }
  }

  private renderEducation(doc: PDFKit.PDFDocument, cv: CvDocument): void {
    for (const entry of cv.education) {
      this.avoidOrphanHeading(doc, 70);
      doc.font('Helvetica-Bold').fontSize(11).text(entry.title);
      if (entry.subtitle)
        doc.font('Helvetica-Oblique').fontSize(BODY_FONT_SIZE).text(entry.subtitle);
      doc.font('Helvetica').fontSize(9).text(entry.date);
      if (entry.description) doc.moveDown(0.15).fontSize(BODY_FONT_SIZE).text(entry.description);
      doc.moveDown(0.4);
    }
  }

  private renderCertifications(doc: PDFKit.PDFDocument, cv: CvDocument): void {
    for (const entry of cv.certifications) {
      this.avoidOrphanHeading(doc, 60);
      doc.font('Helvetica-Bold').fontSize(11).text(entry.title);
      const meta = [entry.provider, entry.date].filter(Boolean).join(' | ');
      doc.font('Helvetica').fontSize(9).text(meta);
      if (entry.skills.length) doc.moveDown(0.1).fontSize(9).text(entry.skills.join(', '));
      doc.moveDown(0.4);
    }
  }

  private renderAchievements(doc: PDFKit.PDFDocument, cv: CvDocument): void {
    for (const entry of cv.achievements) {
      this.avoidOrphanHeading(doc, 60);
      doc.font('Helvetica-Bold').fontSize(11).text(entry.title);
      const meta = [entry.organization, entry.date].filter(Boolean).join(' | ');
      if (meta) doc.font('Helvetica').fontSize(9).text(meta);
      if (entry.description) doc.moveDown(0.1).fontSize(BODY_FONT_SIZE).text(entry.description);
      doc.moveDown(0.4);
    }
  }

  /** Forces a page break before starting a new heading/entry that wouldn't have room for at
   *  least a couple of lines below it - avoids orphaning a heading alone at the bottom of a
   *  page. `minSpace` is a rough per-entry budget, not exact typesetting. */
  private avoidOrphanHeading(doc: PDFKit.PDFDocument, minSpace = 60): void {
    if (doc.y > doc.page.height - doc.page.margins.bottom - minSpace) {
      doc.addPage();
    }
  }
}
