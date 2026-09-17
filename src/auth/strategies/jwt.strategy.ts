import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

export interface JwtPayload {
  sub: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /**
   * Re-reads the user on every request rather than trusting the token payload alone, so
   * deactivating an account takes effect immediately instead of when their token expires.
   *
   * Role and tenant are resolved here too, for the same reason: they must never come from
   * the token body or a request parameter, or a caller could claim a role or tenant they do
   * not have. For CLIENT this also resolves personId (the Person their one tenant owns) in
   * the same query, so every existing profile-domain controller can keep using
   * `user.personId` unchanged - see AuthenticatedUser.
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        tenantId: true,
        tenant: { select: { slug: true, person: { select: { id: true } } } },
      },
    });

    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Account is no longer active');
    }

    // A CLIENT with no resolvable tenant/person is a data-integrity problem, not a request
    // this platform can safely serve - fail closed rather than let personId end up null in
    // a controller that assumes it is always set.
    if (user.role === Role.CLIENT && (!user.tenantId || !user.tenant?.person)) {
      throw new UnauthorizedException('This account has no accessible tenant');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      tenantSlug: user.tenant?.slug ?? null,
      personId: user.tenant?.person?.id ?? null,
    };
  }
}
