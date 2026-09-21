import { PDFParse } from 'pdf-parse';
import JSZip from 'jszip';
import { CvDocument } from './cv-document.model';
import { CvPdfGenerator } from './generators/cv-pdf.generator';
import { CvDocxGenerator } from './generators/cv-docx.generator';

/**
 * Proves the two generators produce real, structured documents - never a screenshot/image -
 * by round-tripping their output through a real parser and asserting known keywords are
 * genuinely extractable as text, not baked into pixels.
 *
 * Requires `NODE_OPTIONS=--experimental-vm-modules` (set on the `test`/`test:cov` scripts in
 * package.json): pdf-parse's underlying pdfjs-dist tries a dynamic `import()` for its
 * Node worker fallback, which Jest's default CJS test environment cannot execute without it.
 */
describe('CV document generators', () => {
  const fixture: CvDocument = {
    meta: {
      title: 'Jane Doe - CV',
      author: 'Jane Doe',
      subject: 'Curriculum Vitae',
      creator: 'Portfolio Platform CV Generator',
    },
    header: {
      fullName: 'Jane Doe',
      headline: 'Senior Frontend Engineer',
      location: 'Remote',
      contacts: [
        { label: 'Email', value: 'jane@example.com', href: 'mailto:jane@example.com' },
        {
          label: 'LinkedIn',
          value: 'linkedin.com/in/janedoe',
          href: 'https://linkedin.com/in/janedoe',
        },
      ],
    },
    summary: 'Experienced engineer specializing in Angular and TypeScript.',
    sectionOrder: ['experience', 'skills', 'projects'],
    experience: [
      {
        organization: 'Acme Corp',
        role: 'Senior Engineer',
        location: 'Remote',
        dateRange: 'Jan 2022 – Present',
        bullets: ['Led the Angular migration to standalone components.'],
        technologies: ['Angular', 'TypeScript', 'NestJS'],
      },
    ],
    skills: [{ category: 'Frontend', skills: ['Angular', 'TypeScript', 'RxJS'] }],
    projects: [
      {
        name: 'RAG Platform',
        role: 'Lead Engineer',
        dateRange: '2023',
        description: 'Built a retrieval-augmented generation pipeline.',
        highlights: ['Reduced query latency significantly.'],
        technologies: ['NestJS', 'PostgreSQL', 'Docker'],
        githubUrl: 'https://github.com/janedoe/rag',
        liveUrl: null,
      },
    ],
    education: [],
    certifications: [],
    achievements: [],
  };

  describe('CvPdfGenerator', () => {
    it('produces a PDF with real, extractable text - not a rasterized image', async () => {
      const buffer = await new CvPdfGenerator().generate(fixture);
      expect(buffer.subarray(0, 4).toString()).toBe('%PDF');

      const parser = new PDFParse({ data: buffer });
      const { text } = await parser.getText();
      await parser.destroy();

      expect(text).toContain('Jane Doe');
      expect(text).toContain('Angular');
      expect(text).toContain('TypeScript');
      expect(text).toContain('NestJS');
      expect(text).toContain('PostgreSQL');
    });
  });

  describe('CvDocxGenerator', () => {
    it('produces a real OOXML .docx archive containing the expected text', async () => {
      const buffer = await new CvDocxGenerator().generate(fixture);
      // A .docx is a real ZIP archive (PK signature) - never an image or plain text blob.
      expect(buffer.subarray(0, 2).toString()).toBe('PK');

      const zip = await JSZip.loadAsync(buffer);
      const documentXml = await zip.file('word/document.xml')?.async('string');
      expect(documentXml).toBeDefined();
      expect(documentXml).toContain('Jane Doe');
      expect(documentXml).toContain('Angular');
      expect(documentXml).toContain('Professional Experience');
    });
  });
});
