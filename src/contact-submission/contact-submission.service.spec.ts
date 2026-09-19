import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ContactSubmissionStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { SpamGuardService } from './spam-guard.service';
import { ContactSubmissionService } from './contact-submission.service';
import { CreateContactSubmissionDto } from './dto/contact-submission.dto';

describe('ContactSubmissionService', () => {
  let service: ContactSubmissionService;
  let prisma: {
    contactSubmission: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let auditLog: { log: jest.Mock };
  let spamGuard: { evaluate: jest.Mock };

  const baseDto: CreateContactSubmissionDto = {
    name: 'Jane Doe',
    email: 'JANE@Example.com',
    subject: 'Interested',
    message: 'Hello there',
  };

  beforeEach(async () => {
    prisma = {
      contactSubmission: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    auditLog = { log: jest.fn() };
    spamGuard = { evaluate: jest.fn().mockReturnValue({ allowed: true }) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ContactSubmissionService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
        { provide: SpamGuardService, useValue: spamGuard },
      ],
    }).compile();

    service = moduleRef.get(ContactSubmissionService);
  });

  describe('submit', () => {
    it('strips HTML from every free-text field before persisting', async () => {
      prisma.contactSubmission.create.mockResolvedValue({ id: 's1' });

      await service.submit(
        {
          ...baseDto,
          name: '<script>alert(1)</script>Jane',
          company: '<b>Acme</b> Inc',
          subject: 'Hi <i>there</i>',
          message: 'Hello <b>World</b>',
        },
        {},
      );

      const data = prisma.contactSubmission.create.mock.calls[0][0].data;
      expect(data.name).toBe('Jane');
      expect(data.company).toBe('Acme Inc');
      expect(data.subject).toBe('Hi there');
      expect(data.message).toBe('Hello World');
    });

    it('lowercases and trims the email', async () => {
      prisma.contactSubmission.create.mockResolvedValue({ id: 's1' });

      await service.submit(baseDto, {});

      expect(prisma.contactSubmission.create.mock.calls[0][0].data.email).toBe('jane@example.com');
    });

    it('records the submitter IP and user agent from the request context', async () => {
      prisma.contactSubmission.create.mockResolvedValue({ id: 's1' });

      await service.submit(baseDto, { ipAddress: '1.2.3.4', userAgent: 'curl/8' });

      const data = prisma.contactSubmission.create.mock.calls[0][0].data;
      expect(data.ipAddress).toBe('1.2.3.4');
      expect(data.userAgent).toBe('curl/8');
    });

    it('persists a submission that fails the spam guard as SPAM rather than rejecting it', async () => {
      spamGuard.evaluate.mockReturnValue({ allowed: false, reason: 'honeypot' });
      prisma.contactSubmission.create.mockResolvedValue({ id: 's1' });

      const result = await service.submit(baseDto, {});

      expect(prisma.contactSubmission.create.mock.calls[0][0].data.status).toBe(
        ContactSubmissionStatus.SPAM,
      );
      // The caller (a possible bot) gets back the same successful response either way -
      // see the class doc on why this is silent rather than a rejection.
      expect(result).toEqual({ id: 's1' });
    });

    it('marks a submission that passes the spam guard as NEW', async () => {
      prisma.contactSubmission.create.mockResolvedValue({ id: 's1' });

      await service.submit(baseDto, {});

      expect(prisma.contactSubmission.create.mock.calls[0][0].data.status).toBe(
        ContactSubmissionStatus.NEW,
      );
    });

    it('audits creation with a null actor - this is an unauthenticated, public endpoint', async () => {
      prisma.contactSubmission.create.mockResolvedValue({ id: 's1' });

      await service.submit(baseDto, {});

      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actor: null,
          action: 'CONTACT_SUBMISSION_CREATED',
          resourceId: 's1',
        }),
      );
    });

    it('audits a spam-blocked submission distinctly, with the reason', async () => {
      spamGuard.evaluate.mockReturnValue({ allowed: false, reason: 'too-fast' });
      prisma.contactSubmission.create.mockResolvedValue({ id: 's1' });

      await service.submit(baseDto, {});

      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CONTACT_SUBMISSION_SPAM_BLOCKED',
          metadata: { reason: 'too-fast' },
        }),
      );
    });
  });

  describe('updateStatus', () => {
    const actor: AuthenticatedUser = {
      id: 'admin-1',
      email: 'admin@example.com',
      name: 'Admin',
      role: Role.ADMIN,
      tenantId: null,
      tenantSlug: null,
      personId: null,
    };

    it('throws NotFoundException for an unknown id', async () => {
      prisma.contactSubmission.findUnique.mockResolvedValue(null);

      await expect(
        service.updateStatus('missing', ContactSubmissionStatus.RESOLVED, actor),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('records who resolved it and when', async () => {
      prisma.contactSubmission.findUnique.mockResolvedValue({
        id: 's1',
        status: ContactSubmissionStatus.NEW,
      });
      prisma.contactSubmission.update.mockResolvedValue({
        id: 's1',
        status: ContactSubmissionStatus.RESOLVED,
      });

      await service.updateStatus('s1', ContactSubmissionStatus.RESOLVED, actor);

      const data = prisma.contactSubmission.update.mock.calls[0][0].data;
      expect(data.status).toBe(ContactSubmissionStatus.RESOLVED);
      expect(data.resolvedById).toBe('admin-1');
      expect(data.resolvedAt).toBeInstanceOf(Date);
    });

    it('audits the transition with both the old and new status', async () => {
      prisma.contactSubmission.findUnique.mockResolvedValue({
        id: 's1',
        status: ContactSubmissionStatus.NEW,
      });
      prisma.contactSubmission.update.mockResolvedValue({
        id: 's1',
        status: ContactSubmissionStatus.RESOLVED,
      });

      await service.updateStatus('s1', ContactSubmissionStatus.RESOLVED, actor);

      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actor,
          action: 'CONTACT_SUBMISSION_STATUS_CHANGED',
          resourceId: 's1',
          metadata: { from: ContactSubmissionStatus.NEW, to: ContactSubmissionStatus.RESOLVED },
        }),
      );
    });
  });
});
