import { Injectable, NotFoundException } from '@nestjs/common';
import { ContactSubmissionStatus } from '@prisma/client';
import sanitizeHtml from 'sanitize-html';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { SpamGuardService } from './spam-guard.service';
import {
  ContactSubmissionResponseDto,
  CreateContactSubmissionDto,
} from './dto/contact-submission.dto';

/** Strips every tag, leaving plain text - these fields are never rendered as HTML. */
function sanitize(value: string): string {
  return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }).trim();
}

export interface SubmitContext {
  ipAddress?: string;
  userAgent?: string;
}

/**
 * A submission that fails the spam guard is still persisted, as SPAM, and still answers
 * with the same success response a real inquiry gets - see ContactSubmissionController.
 * Telling a bot its submission was rejected only teaches it to adapt; silently shadow-
 * banning it while keeping the row (and an audit trail) for admin visibility does not.
 */
@Injectable()
export class ContactSubmissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly spamGuard: SpamGuardService,
  ) {}

  async submit(
    dto: CreateContactSubmissionDto,
    context: SubmitContext,
  ): Promise<ContactSubmissionResponseDto> {
    const spamCheck = this.spamGuard.evaluate({
      honeypot: dto.honeypot,
      formLoadedAt: dto.formLoadedAt,
    });

    const submission = await this.prisma.contactSubmission.create({
      data: {
        name: sanitize(dto.name),
        email: dto.email.trim().toLowerCase(),
        phone: dto.phone ? sanitize(dto.phone) : null,
        company: dto.company ? sanitize(dto.company) : null,
        subject: sanitize(dto.subject),
        message: sanitize(dto.message),
        status: spamCheck.allowed ? ContactSubmissionStatus.NEW : ContactSubmissionStatus.SPAM,
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
      },
    });

    await this.auditLog.log({
      actor: null,
      action: spamCheck.allowed ? 'CONTACT_SUBMISSION_CREATED' : 'CONTACT_SUBMISSION_SPAM_BLOCKED',
      resource: 'contact_submission',
      resourceId: submission.id,
      metadata: spamCheck.reason ? { reason: spamCheck.reason } : undefined,
    });

    return submission;
  }

  async findAll(params: {
    status?: ContactSubmissionStatus;
    page?: number;
    limit?: number;
  }): Promise<{
    data: ContactSubmissionResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 50, 200);
    const where = params.status ? { status: params.status } : {};

    const [data, total] = await Promise.all([
      this.prisma.contactSubmission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.contactSubmission.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async updateStatus(
    id: string,
    status: ContactSubmissionStatus,
    actor: AuthenticatedUser,
  ): Promise<ContactSubmissionResponseDto> {
    const existing = await this.prisma.contactSubmission.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Contact submission not found');

    const updated = await this.prisma.contactSubmission.update({
      where: { id },
      data: {
        status,
        resolvedById: actor.id,
        resolvedAt: new Date(),
      },
    });

    await this.auditLog.log({
      actor,
      action: 'CONTACT_SUBMISSION_STATUS_CHANGED',
      resource: 'contact_submission',
      resourceId: id,
      metadata: { from: existing.status, to: status },
    });

    return updated;
  }
}
