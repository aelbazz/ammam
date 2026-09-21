import { Injectable } from '@nestjs/common';
import {
  AlignmentType,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  TextRun,
  convertInchesToTwip,
  convertMillimetersToTwip,
} from 'docx';
import { CvDocument, CvContactLine } from '../cv-document.model';
import { cvSectionHeading } from '../cv-section-registry';

const BULLET_LIST_REF = 'cv-bullet-list';

/**
 * Renders a CvDocument as a real, editable Word document via `docx` - real Heading styles,
 * real Paragraph/bulleted-list structures, real ExternalHyperlink fields. Never an
 * absolutely-positioned text box, never a table used for page layout.
 */
@Injectable()
export class CvDocxGenerator {
  async generate(cv: CvDocument): Promise<Buffer> {
    const children: Paragraph[] = [
      ...this.buildHeader(cv),
      ...(cv.summary ? this.buildSummary(cv.summary) : []),
    ];

    for (const key of cv.sectionOrder) {
      children.push(
        new Paragraph({ heading: HeadingLevel.HEADING_1, text: cvSectionHeading(key) }),
      );
      children.push(...this.buildSection(cv, key));
    }

    const doc = new Document({
      creator: cv.meta.creator,
      title: cv.meta.title,
      subject: cv.meta.subject,
      description: 'ATS-optimized CV',
      numbering: {
        config: [
          {
            reference: BULLET_LIST_REF,
            levels: [
              {
                level: 0,
                format: LevelFormat.BULLET,
                text: '•',
                alignment: AlignmentType.LEFT,
                style: {
                  paragraph: {
                    indent: { left: convertInchesToTwip(0.25), hanging: convertInchesToTwip(0.25) },
                  },
                },
              },
            ],
          },
        ],
      },
      sections: [
        {
          properties: {
            page: {
              size: {
                width: convertMillimetersToTwip(210),
                height: convertMillimetersToTwip(297), // A4
              },
              margin: {
                top: convertInchesToTwip(1),
                bottom: convertInchesToTwip(1),
                left: convertInchesToTwip(1),
                right: convertInchesToTwip(1),
              },
            },
          },
          children,
        },
      ],
    });

    return Packer.toBuffer(doc);
  }

  private buildHeader(cv: CvDocument): Paragraph[] {
    const paragraphs: Paragraph[] = [
      new Paragraph({
        heading: HeadingLevel.TITLE,
        children: [new TextRun({ text: cv.header.fullName, bold: true })],
      }),
      new Paragraph({ text: cv.header.headline }),
    ];

    const locationAndContacts: string[] = [];
    if (cv.header.location) locationAndContacts.push(cv.header.location);

    if (locationAndContacts.length) {
      paragraphs.push(new Paragraph({ text: locationAndContacts.join(' | ') }));
    }
    if (cv.header.contacts.length) {
      paragraphs.push(new Paragraph({ children: this.buildContactRuns(cv.header.contacts) }));
    }

    return paragraphs;
  }

  private buildContactRuns(contacts: CvContactLine[]): (TextRun | ExternalHyperlink)[] {
    const runs: (TextRun | ExternalHyperlink)[] = [];
    contacts.forEach((contact, i) => {
      if (i > 0) runs.push(new TextRun('  |  '));
      runs.push(new TextRun(`${contact.label}: `));
      if (contact.href) {
        runs.push(
          new ExternalHyperlink({
            link: contact.href,
            children: [new TextRun({ text: contact.value, style: 'Hyperlink' })],
          }),
        );
      } else {
        runs.push(new TextRun(contact.value));
      }
    });
    return runs;
  }

  private buildSummary(summary: string): Paragraph[] {
    return [
      new Paragraph({ heading: HeadingLevel.HEADING_1, text: 'Professional Summary' }),
      new Paragraph({ text: summary }),
    ];
  }

  private buildSection(cv: CvDocument, key: string): Paragraph[] {
    switch (key) {
      case 'experience':
        return this.buildExperience(cv);
      case 'skills':
        return this.buildSkills(cv);
      case 'projects':
        return this.buildProjects(cv);
      case 'education':
        return this.buildEducation(cv);
      case 'courses':
        return this.buildCertifications(cv);
      case 'achievements':
        return this.buildAchievements(cv);
      default:
        return [];
    }
  }

  private bullet(text: string): Paragraph {
    return new Paragraph({
      numbering: { reference: BULLET_LIST_REF, level: 0 },
      children: [new TextRun(text)],
    });
  }

  private buildExperience(cv: CvDocument): Paragraph[] {
    const paragraphs: Paragraph[] = [];
    for (const entry of cv.experience) {
      paragraphs.push(
        new Paragraph({ children: [new TextRun({ text: entry.organization, bold: true })] }),
      );
      paragraphs.push(
        new Paragraph({ children: [new TextRun({ text: entry.role, italics: true })] }),
      );
      const meta = [entry.location, entry.dateRange].filter(Boolean).join(' | ');
      if (meta) paragraphs.push(new Paragraph({ text: meta }));
      for (const bullet of entry.bullets) paragraphs.push(this.bullet(bullet));
      if (entry.technologies.length) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Technologies: ', bold: true }),
              new TextRun(entry.technologies.join(', ')),
            ],
          }),
        );
      }
      paragraphs.push(new Paragraph({ text: '' }));
    }
    return paragraphs;
  }

  private buildSkills(cv: CvDocument): Paragraph[] {
    return cv.skills.map(
      (group) =>
        new Paragraph({
          children: [
            new TextRun({ text: `${group.category}: `, bold: true }),
            new TextRun(group.skills.join(', ')),
          ],
        }),
    );
  }

  private buildProjects(cv: CvDocument): Paragraph[] {
    const paragraphs: Paragraph[] = [];
    for (const project of cv.projects) {
      paragraphs.push(
        new Paragraph({ children: [new TextRun({ text: project.name, bold: true })] }),
      );
      const meta = [project.role, project.dateRange].filter(Boolean).join(' | ');
      if (meta) paragraphs.push(new Paragraph({ text: meta }));
      paragraphs.push(new Paragraph({ text: project.description }));
      if (project.technologies.length) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Technologies: ', bold: true }),
              new TextRun(project.technologies.join(', ')),
            ],
          }),
        );
      }
      for (const highlight of project.highlights) paragraphs.push(this.bullet(highlight));
      const links = [
        project.githubUrl ? `GitHub: ${project.githubUrl}` : null,
        project.liveUrl ? `Live: ${project.liveUrl}` : null,
      ].filter((v): v is string => Boolean(v));
      if (links.length) paragraphs.push(new Paragraph({ text: links.join('  |  ') }));
      paragraphs.push(new Paragraph({ text: '' }));
    }
    return paragraphs;
  }

  private buildEducation(cv: CvDocument): Paragraph[] {
    const paragraphs: Paragraph[] = [];
    for (const entry of cv.education) {
      paragraphs.push(
        new Paragraph({ children: [new TextRun({ text: entry.title, bold: true })] }),
      );
      if (entry.subtitle) {
        paragraphs.push(
          new Paragraph({ children: [new TextRun({ text: entry.subtitle, italics: true })] }),
        );
      }
      paragraphs.push(new Paragraph({ text: entry.date }));
      if (entry.description) paragraphs.push(new Paragraph({ text: entry.description }));
      paragraphs.push(new Paragraph({ text: '' }));
    }
    return paragraphs;
  }

  private buildCertifications(cv: CvDocument): Paragraph[] {
    const paragraphs: Paragraph[] = [];
    for (const entry of cv.certifications) {
      paragraphs.push(
        new Paragraph({ children: [new TextRun({ text: entry.title, bold: true })] }),
      );
      const meta = [entry.provider, entry.date].filter(Boolean).join(' | ');
      paragraphs.push(new Paragraph({ text: meta }));
      if (entry.skills.length) paragraphs.push(new Paragraph({ text: entry.skills.join(', ') }));
      paragraphs.push(new Paragraph({ text: '' }));
    }
    return paragraphs;
  }

  private buildAchievements(cv: CvDocument): Paragraph[] {
    const paragraphs: Paragraph[] = [];
    for (const entry of cv.achievements) {
      paragraphs.push(
        new Paragraph({ children: [new TextRun({ text: entry.title, bold: true })] }),
      );
      const meta = [entry.organization, entry.date].filter(Boolean).join(' | ');
      if (meta) paragraphs.push(new Paragraph({ text: meta }));
      if (entry.description) paragraphs.push(new Paragraph({ text: entry.description }));
      paragraphs.push(new Paragraph({ text: '' }));
    }
    return paragraphs;
  }
}
