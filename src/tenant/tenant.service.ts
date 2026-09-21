import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AvatarSource, Prisma, Role, Tenant, TenantStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { TenantLifecycleService } from './tenant-lifecycle.service';
import { SectionService } from '../section/section.service';
import { CvVersionService } from '../cv/cv-version.service';
import { defaultAvatarUrl } from '../storage/default-avatar.util';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { isValidSlugFormat, normalizeSlug, slugCandidates } from '../common/utils/slug.util';
import {
  CreateTenantAsCoordinatorDto,
  CreateTenantDto,
  TenantResponseDto,
  UpdateTenantAsCoordinatorDto,
  UpdateTenantDto,
} from './dto/tenant.dto';

const DEFAULT_PLAN_ID = 'plan_free_default';

@Injectable()
export class TenantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: TenantLifecycleService,
    private readonly auditLog: AuditLogService,
    private readonly config: ConfigService,
  ) {}

  // -- reads --------------------------------------------------------------

  /** Admin: every tenant, optionally filtered. */
  async findAllForAdmin(filters: { status?: TenantStatus; coordinatorId?: string }) {
    const rows = await this.prisma.tenant.findMany({
      where: {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.coordinatorId ? { coordinatorId: filters.coordinatorId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: this.detailInclude(),
    });
    return rows.map((t) => this.toDto(t));
  }

  /** Coordinator: only tenants assigned to them. */
  async findAllForCoordinator(coordinatorId: string) {
    const rows = await this.prisma.tenant.findMany({
      where: { coordinatorId },
      orderBy: { createdAt: 'desc' },
      include: this.detailInclude(),
    });
    return rows.map((t) => this.toDto(t));
  }

  async findOneForAdmin(id: string): Promise<TenantResponseDto> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: this.detailInclude(),
    });
    if (!tenant) throw new NotFoundException(`Tenant ${id} not found`);
    return this.toDto(tenant);
  }

  /** Coordinator: same lookup, but only for a tenant assigned to them - 404 otherwise, not
   *  403, so a coordinator cannot distinguish "not mine" from "does not exist". */
  async findOneForCoordinator(coordinatorId: string, id: string): Promise<TenantResponseDto> {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id, coordinatorId },
      include: this.detailInclude(),
    });
    if (!tenant) throw new NotFoundException(`Tenant ${id} not found`);
    return this.toDto(tenant);
  }

  // -- create (onboarding) -------------------------------------------------

  /**
   * The full onboarding transaction: Tenant + Person(placeholder) + User(CLIENT) +
   * Subscription + Theme + WebsiteSettings + ClientSection defaults + a default CvVersion,
   * all or nothing. If any step fails, nothing is left half-created.
   */
  async create(
    actor: AuthenticatedUser,
    dto: CreateTenantDto | CreateTenantAsCoordinatorDto,
    options: { coordinatorId?: string | null; planId?: string } = {},
  ): Promise<TenantResponseDto> {
    const slug = dto.slug
      ? await this.acceptExplicitSlug(dto.slug)
      : await this.generateSlugFromName(dto.name);
    const planId = options.planId ?? DEFAULT_PLAN_ID;

    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new BadRequestException(`Plan ${planId} does not exist`);

    const existingClient = await this.prisma.user.findUnique({
      where: { email: dto.clientEmail.toLowerCase().trim() },
    });
    if (existingClient) {
      throw new ConflictException('A user with this email already exists');
    }

    const passwordHash = await argon2.hash(dto.clientPassword, { type: argon2.argon2id });

    const tenant = await this.prisma.$transaction(async (tx) => {
      const created = await tx.tenant.create({
        data: {
          slug,
          name: dto.name,
          status: TenantStatus.PENDING,
          createdById: actor.id,
          coordinatorId: options.coordinatorId ?? null,
        },
      });

      const person = await tx.person.create({
        data: {
          tenantId: created.id,
          name: dto.name,
          title: 'Add your professional title',
          summary: 'Add a short professional summary.',
          location: 'Add your location',
          yearsOfExperience: 0,
          avatar: defaultAvatarUrl(this.config),
          avatarSource: AvatarSource.DEFAULT,
          tagline: 'Add a tagline',
        },
      });

      await tx.user.create({
        data: {
          email: dto.clientEmail.toLowerCase().trim(),
          passwordHash,
          name: dto.name,
          role: Role.CLIENT,
          tenantId: created.id,
        },
      });

      await tx.subscription.create({
        data: { tenantId: created.id, planId: plan.id, status: 'TRIAL', autoRenew: false },
      });

      await tx.tenantTheme.create({ data: { tenantId: created.id } });

      await tx.websiteSettings.create({
        data: { tenantId: created.id, websiteTitle: dto.name },
      });

      await tx.clientSection.createMany({
        data: SectionService.defaultCreateData(created.id),
      });

      await tx.cvVersion.create({
        data: CvVersionService.defaultCreateData(person.id),
      });

      return created;
    });

    await this.auditLog.log({
      actor,
      tenantId: tenant.id,
      action: 'TENANT_CREATED',
      resource: 'tenant',
      resourceId: tenant.id,
      metadata: { slug: tenant.slug, coordinatorId: options.coordinatorId ?? null },
    });

    return this.findOneForAdmin(tenant.id);
  }

  // -- updates --------------------------------------------------------------

  async updateAsAdmin(
    actor: AuthenticatedUser,
    id: string,
    dto: UpdateTenantDto,
  ): Promise<TenantResponseDto> {
    const tenant = await this.getOrThrow(id);
    const data: Prisma.TenantUpdateInput = {};

    if (dto.name !== undefined) data.name = dto.name;

    if (dto.slug !== undefined) {
      const nextSlug = normalizeSlug(dto.slug);
      if (nextSlug !== tenant.slug) {
        await this.assertSlugAvailable(nextSlug, id);
        data.slug = nextSlug;
      }
    }

    await this.prisma.$transaction(async (tx) => {
      if (data.slug && typeof data.slug === 'string') {
        // Retire the old slug so it still resolves (see PublicProfileService), and so no
        // other tenant can claim it out from under the old links.
        await tx.tenantSlugHistory.create({ data: { tenantId: id, slug: tenant.slug } });
        // If the new slug is one of THIS tenant's own retired slugs (reclaiming a previous
        // name), drop that history row - it is live again, not "moved away from" any more.
        await tx.tenantSlugHistory.deleteMany({ where: { tenantId: id, slug: data.slug } });
      }
      await tx.tenant.update({ where: { id }, data });
    });

    await this.auditLog.log({
      actor,
      tenantId: id,
      action: 'TENANT_UPDATED',
      resource: 'tenant',
      resourceId: id,
      metadata: { name: dto.name, slug: dto.slug },
    });

    return this.findOneForAdmin(id);
  }

  /** Coordinator: name only, and only for a tenant assigned to them. */
  async updateAsCoordinator(
    actor: AuthenticatedUser,
    coordinatorId: string,
    id: string,
    dto: UpdateTenantAsCoordinatorDto,
  ): Promise<TenantResponseDto> {
    const tenant = await this.prisma.tenant.findFirst({ where: { id, coordinatorId } });
    if (!tenant) throw new NotFoundException(`Tenant ${id} not found`);

    if (dto.name !== undefined) {
      await this.prisma.tenant.update({ where: { id }, data: { name: dto.name } });
      await this.auditLog.log({
        actor,
        tenantId: id,
        action: 'TENANT_UPDATED',
        resource: 'tenant',
        resourceId: id,
        metadata: { name: dto.name },
      });
    }

    return this.findOneForCoordinator(coordinatorId, id);
  }

  async updateStatus(
    actor: AuthenticatedUser,
    id: string,
    status: TenantStatus,
  ): Promise<TenantResponseDto> {
    const tenant = await this.getOrThrow(id);
    this.lifecycle.assertTransition(tenant.status, status);

    await this.prisma.tenant.update({ where: { id }, data: { status } });

    await this.auditLog.log({
      actor,
      tenantId: id,
      action: 'TENANT_STATUS_CHANGED',
      resource: 'tenant',
      resourceId: id,
      metadata: { from: tenant.status, to: status },
    });

    return this.findOneForAdmin(id);
  }

  async updateCoordinator(
    actor: AuthenticatedUser,
    id: string,
    coordinatorId: string | null,
  ): Promise<TenantResponseDto> {
    const tenant = await this.getOrThrow(id);

    if (coordinatorId) {
      const coordinator = await this.prisma.user.findUnique({ where: { id: coordinatorId } });
      if (!coordinator || coordinator.role !== Role.COORDINATOR) {
        throw new BadRequestException(`${coordinatorId} is not a coordinator`);
      }
    }

    await this.prisma.tenant.update({ where: { id }, data: { coordinatorId } });

    await this.auditLog.log({
      actor,
      tenantId: id,
      action: 'TENANT_COORDINATOR_REASSIGNED',
      resource: 'tenant',
      resourceId: id,
      metadata: { from: tenant.coordinatorId, to: coordinatorId },
    });

    return this.findOneForAdmin(id);
  }

  /**
   * Generates a new temporary password for the tenant's CLIENT account and returns it once,
   * in plain text, to the caller (an Admin) - it is never stored or logged anywhere else.
   */
  async resetClientAccess(
    actor: AuthenticatedUser,
    id: string,
  ): Promise<{ temporaryPassword: string }> {
    await this.getOrThrow(id);

    const client = await this.prisma.user.findUnique({ where: { tenantId: id } });
    if (!client) throw new NotFoundException('This tenant has no client account');

    const temporaryPassword = randomBytes(9).toString('base64url'); // 12 chars, URL-safe
    const passwordHash = await argon2.hash(temporaryPassword, { type: argon2.argon2id });

    await this.prisma.user.update({ where: { id: client.id }, data: { passwordHash } });

    await this.auditLog.log({
      actor,
      tenantId: id,
      action: 'TENANT_ACCESS_RESET',
      resource: 'user',
      resourceId: client.id,
    });

    return { temporaryPassword };
  }

  async getActivity(id: string, page?: number, limit?: number) {
    await this.getOrThrow(id);
    return this.auditLog.list({ tenantId: id, page, limit });
  }

  // -- helpers --------------------------------------------------------------

  private async getOrThrow(id: string): Promise<Tenant> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException(`Tenant ${id} not found`);
    return tenant;
  }

  private detailInclude() {
    return {
      coordinator: { select: { email: true } },
      client: { select: { email: true } },
      subscription: { select: { status: true, plan: { select: { name: true } } } },
    } satisfies Prisma.TenantInclude;
  }

  private toDto(
    tenant: Tenant & {
      coordinator?: { email: string } | null;
      client?: { email: string } | null;
      subscription?: { status: string; plan: { name: string } } | null;
    },
  ): TenantResponseDto {
    return {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      status: tenant.status,
      coordinatorId: tenant.coordinatorId,
      coordinatorEmail: tenant.coordinator?.email ?? null,
      createdById: tenant.createdById,
      clientEmail: tenant.client?.email ?? null,
      subscriptionStatus: tenant.subscription?.status,
      planName: tenant.subscription?.plan.name,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };
  }

  /**
   * A slug the caller typed explicitly is validated strictly and never silently changed:
   * invalid format or a reserved word is a 400, an already-used slug is a 409. Silently
   * substituting a different slug here would mean a caller who asked for "admin" could end
   * up with "admin-2" without knowing it - confusing at best, and it also means a reserved
   * word could be "worked around" by accident instead of being rejected outright.
   */
  private async acceptExplicitSlug(rawSlug: string): Promise<string> {
    const slug = normalizeSlug(rawSlug);
    await this.assertSlugAvailable(slug);
    return slug;
  }

  /** Turns a name into an available slug: "Jane Doe" -> "jane-doe", or "jane-doe-2" if
   *  that is taken, checked against both live tenants and retired slugs. Only used when no
   *  slug was explicitly requested - the auto-suffix fallback belongs here, not in the
   *  explicit-slug path above. */
  private async generateSlugFromName(name: string): Promise<string> {
    for (const candidate of slugCandidates(name)) {
      if (!isValidSlugFormat(candidate)) continue;
      if (await this.isSlugFree(candidate)) return candidate;
    }
    throw new ConflictException('Could not generate an available slug');
  }

  private async assertSlugAvailable(slug: string, excludeTenantId?: string): Promise<void> {
    if (!isValidSlugFormat(slug)) {
      throw new BadRequestException(
        'Slug is invalid or reserved. Use lowercase letters, digits and hyphens only.',
      );
    }
    if (!(await this.isSlugFree(slug, excludeTenantId))) {
      throw new ConflictException(`Slug "${slug}" is already in use`);
    }
  }

  /**
   * `excludeTenantId`, when given, lets a tenant reclaim a slug retired in its OWN history
   * (e.g. renaming back to a previous name) - that slug already points at this same tenant,
   * so it is not really "taken". It never allows claiming a slug live on, or retired by,
   * a DIFFERENT tenant.
   */
  private async isSlugFree(slug: string, excludeTenantId?: string): Promise<boolean> {
    const [live, retired] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { slug }, select: { id: true } }),
      this.prisma.tenantSlugHistory.findUnique({ where: { slug }, select: { tenantId: true } }),
    ]);
    if (live && live.id !== excludeTenantId) return false;
    if (retired && retired.tenantId !== excludeTenantId) return false;
    return true;
  }
}
