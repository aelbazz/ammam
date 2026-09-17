import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { Role, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CreateAdminDto, CreateCoordinatorDto, UserResponseDto } from './dto/user.dto';

/**
 * Platform-level accounts (ADMIN, COORDINATOR). CLIENT accounts are created only as part of
 * tenant onboarding (TenantService.create) - there is no standalone "create a client"
 * operation, because a client without a tenant makes no sense.
 */
@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async listAll(role?: Role): Promise<UserResponseDto[]> {
    const rows = await this.prisma.user.findMany({
      where: role ? { role } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((u) => this.toDto(u));
  }

  async createCoordinator(
    actor: AuthenticatedUser,
    dto: CreateCoordinatorDto,
  ): Promise<UserResponseDto> {
    return this.createPlatformUser(actor, dto, Role.COORDINATOR);
  }

  async createAdmin(actor: AuthenticatedUser, dto: CreateAdminDto): Promise<UserResponseDto> {
    return this.createPlatformUser(actor, dto, Role.ADMIN);
  }

  private async createPlatformUser(
    actor: AuthenticatedUser,
    dto: CreateCoordinatorDto | CreateAdminDto,
    role: Role,
  ): Promise<UserResponseDto> {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('A user with this email already exists');

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });

    const created = await this.prisma.user.create({
      data: { email, passwordHash, name: dto.name ?? null, role, tenantId: null },
    });

    await this.auditLog.log({
      actor,
      action: `${role}_CREATED`,
      resource: 'user',
      resourceId: created.id,
    });

    return this.toDto(created);
  }

  async updateStatus(
    actor: AuthenticatedUser,
    id: string,
    status: 'active' | 'suspended',
  ): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);

    const updated = await this.prisma.user.update({ where: { id }, data: { status } });

    await this.auditLog.log({
      actor,
      action: 'USER_STATUS_CHANGED',
      resource: 'user',
      resourceId: id,
      metadata: { from: user.status, to: status },
    });

    return this.toDto(updated);
  }

  private toDto(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      tenantId: user.tenantId,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }
}
