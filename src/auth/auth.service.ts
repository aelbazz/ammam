import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/auth-response.dto';
import { JwtPayload } from './strategies/jwt.strategy';

/**
 * Argon2id hash of the string "invalid". Verified against when the email does not exist so
 * a wrong email and a wrong password take the same amount of time - without this, response
 * timing reveals which admin emails are real.
 */
const DUMMY_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$c29tZS1zdGF0aWMtc2FsdA$1B0m1sFBVQ3m3vJ0CkCiT4X0tLmUZk5Z1r5lQkRZ0nE';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const user = await this.prisma.adminUser.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    const passwordMatches = await this.verify(user?.passwordHash ?? DUMMY_HASH, dto.password);

    if (!user || !user.isActive || !passwordMatches) {
      // Deliberately identical for every failure mode - never reveal which part was wrong.
      // The attempted email is not logged: failed logins are where people paste passwords
      // into the email field by mistake.
      this.logger.warn('Rejected login attempt');
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.adminUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const payload: JwtPayload = { sub: user.id, email: user.email };
    const expiresIn = this.config.get<string>('JWT_EXPIRES_IN', '7d');

    return {
      accessToken: await this.jwt.signAsync(payload, { expiresIn }),
      expiresIn: this.toSeconds(expiresIn),
      user: { id: user.id, email: user.email, name: user.name },
    };
  }

  private async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      // A malformed hash must not surface as a 500 - it is still just a failed login.
      return false;
    }
  }

  private toSeconds(expiresIn: string): number {
    const match = /^(\d+)([smhd])$/.exec(expiresIn);
    if (!match) return 0;
    const value = Number(match[1]);
    const multiplier = { s: 1, m: 60, h: 3600, d: 86400 }[match[2]] ?? 1;
    return value * multiplier;
  }
}
