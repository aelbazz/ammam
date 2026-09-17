import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { adminUser: { findUnique: jest.Mock; update: jest.Mock } };
  let jwt: { signAsync: jest.Mock };

  const password = 'correct-horse-battery';
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  });

  beforeEach(async () => {
    prisma = { adminUser: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}) } };
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

  const activeUser = () => ({
    id: 'u1',
    email: 'admin@example.com',
    name: 'Admin',
    passwordHash,
    isActive: true,
    personId: 'tenant-1',
    person: { slug: 'ahmed' },
  });

  it('returns the tenant the administrator manages', async () => {
    prisma.adminUser.findUnique.mockResolvedValue(activeUser());

    const result = await service.login({ email: 'admin@example.com', password });

    // The admin UI needs to know which profile it is editing; the API never accepts a
    // tenant from the client.
    expect(result.user.personId).toBe('tenant-1');
    expect(result.user.personSlug).toBe('ahmed');
  });

  it('issues a token for valid credentials', async () => {
    prisma.adminUser.findUnique.mockResolvedValue(activeUser());

    const result = await service.login({ email: 'admin@example.com', password });

    expect(result.accessToken).toBe('signed.jwt.token');
    expect(result.user).toEqual({
      id: 'u1',
      email: 'admin@example.com',
      name: 'Admin',
      personId: 'tenant-1',
      personSlug: 'ahmed',
    });
    expect(result.expiresIn).toBe(604800);
  });

  it('never returns the password hash', async () => {
    prisma.adminUser.findUnique.mockResolvedValue(activeUser());

    const result = await service.login({ email: 'admin@example.com', password });

    expect(JSON.stringify(result)).not.toContain(passwordHash);
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('records the login timestamp', async () => {
    prisma.adminUser.findUnique.mockResolvedValue(activeUser());

    await service.login({ email: 'admin@example.com', password });

    expect(prisma.adminUser.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u1' } }),
    );
  });

  it('rejects a wrong password', async () => {
    prisma.adminUser.findUnique.mockResolvedValue(activeUser());
    await expect(
      service.login({ email: 'admin@example.com', password: 'wrong-password' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an unknown email', async () => {
    prisma.adminUser.findUnique.mockResolvedValue(null);
    await expect(service.login({ email: 'nobody@example.com', password })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a deactivated account even with the right password', async () => {
    prisma.adminUser.findUnique.mockResolvedValue({ ...activeUser(), isActive: false });
    await expect(service.login({ email: 'admin@example.com', password })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('gives an identical message for every failure mode, revealing nothing', async () => {
    prisma.adminUser.findUnique.mockResolvedValue(null);
    const unknownEmail = await service
      .login({ email: 'a@b.com', password })
      .catch((e) => e.message);

    prisma.adminUser.findUnique.mockResolvedValue(activeUser());
    const wrongPassword = await service
      .login({ email: 'a@b.com', password: 'nope' })
      .catch((e) => e.message);

    expect(unknownEmail).toBe(wrongPassword);
    expect(unknownEmail).toBe('Invalid credentials');
  });

  it('still verifies a hash when the email is unknown, to keep timing uniform', async () => {
    prisma.adminUser.findUnique.mockResolvedValue(null);
    const started = Date.now();
    await service.login({ email: 'nobody@example.com', password }).catch(() => undefined);

    // Argon2 verification is deliberately slow; a short-circuit would return almost instantly.
    expect(Date.now() - started).toBeGreaterThan(5);
  });

  it('normalises the email before lookup', async () => {
    prisma.adminUser.findUnique.mockResolvedValue(activeUser());
    await service.login({ email: '  ADMIN@Example.com  ', password });

    expect(prisma.adminUser.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'admin@example.com' } }),
    );
  });
});
