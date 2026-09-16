import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

import { PersonModule } from './person/person.module';
import { ContactModule } from './contact/contact.module';
import { ExperienceModule } from './experience/experience.module';
import { TechnologyModule } from './technology/technology.module';
import { ProjectModule } from './project/project.module';
import { AchievementModule } from './achievement/achievement.module';
import { CourseModule } from './course/course.module';
import { TimelineEventModule } from './timeline-event/timeline-event.module';
import { ManagementRoleModule } from './management-role/management-role.module';
import { SkillModule } from './skill/skill.module';
import { PublicModule } from './public/public.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // Fails fast at startup on a missing or malformed variable.
      validate: validateEnv,
    }),
    // Only ONE throttler is registered globally on purpose: @nestjs/throttler applies
    // every named throttler in this array to every route, so adding a strict "auth"
    // entry here would throttle the whole API to the login budget. The login route
    // tightens this same 'default' throttler with its own @Throttle override instead.
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: Number(process.env.THROTTLE_TTL_SECONDS ?? 60) * 1000,
        limit: Number(process.env.THROTTLE_LIMIT ?? 120),
      },
    ]),
    PrismaModule,
    AuthModule,

    PersonModule,
    ContactModule,
    ExperienceModule,
    TechnologyModule,
    ProjectModule,
    AchievementModule,
    CourseModule,
    TimelineEventModule,
    ManagementRoleModule,
    SkillModule,

    PublicModule,
    HealthModule,
  ],
  providers: [
    // Order matters: rate limiting runs before authentication, so unauthenticated
    // brute-force traffic is rejected before it reaches Argon2 verification.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Deny-by-default. Routes opt out with @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
