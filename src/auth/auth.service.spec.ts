import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: { findUnique: jest.Mock; update: jest.Mock } };
  let jwt: { signAsync: jest.Mock };

  const password = 'correct-horse-battery';
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  });

  beforeEach(async () => {
    prisma = { user: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}) } };
    jwt = { signAsync: jest.fn().mockResolvedValue('signed.jwt.token') };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        {
          provide: ConfigService,
          useValue: { get: (_k: string, d?: string) => d ?? '7d' },
        },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  const activeClient = () => ({
    id: 'u1',
    email: 'admin@example.com',
    name: 'Admin',
    passwordHash,
    status: 'active',
    role: Role.CLIENT,
    tenantId: 'tenant-1',
    tenant: { slug: 'ahmed' },
  });

  const activePlatformUser = (role: Role) => ({
    id: 'u2',
    email: 'platform@example.com',
    name: 'Platform',
    passwordHash,
    status: 'active',
    role,
    tenantId: null,
    tenant: null,
  });

  it('issues a token for valid credentials', async () => {
    prisma.user.findUnique.mockResolvedValue(activeClient());

    const result = await service.login({ email: 'admin@example.com', password });

    expect(result.accessToken).toBe('signed.jwt.token');
    expect(result.user).toEqual({
      id: 'u1',
      email: 'admin@example.com',
      name: 'Admin',
      role: Role.CLIENT,
      tenantId: 'tenant-1',
      tenantSlug: 'ahmed',
    });
    expect(result.expiresIn).toBe(604800);
  });

  it('never returns the password hash', async () => {
    prisma.user.findUnique.mockResolvedValue(activeClient());

    const result = await service.login({ email: 'admin@example.com', password });

    expect(JSON.stringify(result)).not.toContain(passwordHash);
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('records the login timestamp', async () => {
    prisma.user.findUnique.mockResolvedValue(activeClient());

    await service.login({ email: 'admin@example.com', password });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u1' } }),
    );
  });

  it('returns null tenantId/tenantSlug for a platform ADMIN or COORDINATOR', async () => {
    prisma.user.findUnique.mockResolvedValue(activePlatformUser(Role.ADMIN));

    const result = await service.login({ email: 'platform@example.com', password });

    expect(result.user.role).toBe(Role.ADMIN);
    expect(result.user.tenantId).toBeNull();
    expect(result.user.tenantSlug).toBeNull();
  });

  it('rejects a wrong password', async () => {
    prisma.user.findUnique.mockResolvedValue(activeClient());
    await expect(
      service.login({ email: 'admin@example.com', password: 'wrong-password' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an unknown email', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.login({ email: 'nobody@example.com', password })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a suspended account even with the right password', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...activeClient(), status: 'suspended' });
    await expect(service.login({ email: 'admin@example.com', password })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('gives an identical message for every failure mode, revealing nothing', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const unknownEmail = await service
      .login({ email: 'a@b.com', password })
      .catch((e) => e.message);

    prisma.user.findUnique.mockResolvedValue(activeClient());
    const wrongPassword = await service
      .login({ email: 'a@b.com', password: 'nope' })
      .catch((e) => e.message);

    expect(unknownEmail).toBe(wrongPassword);
    expect(unknownEmail).toBe('Invalid credentials');
  });

  it('still verifies a hash when the email is unknown, to keep timing uniform', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const started = Date.now();
    await service.login({ email: 'nobody@example.com', password }).catch(() => undefined);

    // Argon2 verification is deliberately slow; a short-circuit would return almost instantly.
    expect(Date.now() - started).toBeGreaterThan(5);
  });

  it('normalises the email before lookup', async () => {
    prisma.user.findUnique.mockResolvedValue(activeClient());
    await service.login({ email: '  ADMIN@Example.com  ', password });

    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'admin@example.com' } }),
    );
  });
});
