import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
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
import { ContactSubmissionModule } from './contact-submission/contact-submission.module';
import { TenantAccessModule } from './tenant-access/tenant-access.module';
import { AuditLogModule } from './audit/audit-log.module';
import { TenantModule } from './tenant/tenant.module';
import { UserModule } from './user/user.module';
import { BillingModule } from './billing/billing.module';
import { ThemeModule } from './theme/theme.module';
import { WebsiteSettingsModule } from './website-settings/website-settings.module';
import { SectionModule } from './section/section.module';
import { StorageModule } from './storage/storage.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { PreferencesModule } from './preferences/preferences.module';

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
    // Backs @Cron in SubscriptionExpiryJob (BillingModule) - nothing else uses it yet.
    ScheduleModule.forRoot(),
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
    ContactSubmissionModule,

    TenantModule,
    UserModule,
    BillingModule,
    ThemeModule,
    WebsiteSettingsModule,
    SectionModule,
    DashboardModule,
    PreferencesModule,

    // Global, no controller of their own beyond what's listed: consulted from several
    // otherwise-unrelated modules (tenant lifecycle, public profile access, audit trails).
    TenantAccessModule,
    AuditLogModule,
    StorageModule,
  ],
  providers: [
    // Order matters: rate limiting runs before authentication, so unauthenticated
    // brute-force traffic is rejected before it reaches Argon2 verification.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Deny-by-default. Routes opt out with @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Runs after JwtAuthGuard, so req.user is already populated. Deny-by-role: a route
    // with no @Roles() is open to any authenticated caller; one with @Roles(...) requires
    // the caller's role to be in that list. See RolesGuard.
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
