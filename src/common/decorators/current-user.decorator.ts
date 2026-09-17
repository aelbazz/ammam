import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { Request } from 'express';
import { Role } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;

  /**
   * Set only for role CLIENT; null for ADMIN and COORDINATOR, who have no tenant of their
   * own. Resolved fresh from the database on every request during JWT validation - never
   * trust a tenantId supplied by the client itself.
   */
  tenantId: string | null;
  /** That tenant's public slug, for display. Same trust rule as tenantId. */
  tenantSlug: string | null;

  /**
   * The Person row this CLIENT's tenant owns. Existing purely so the ~10 profile-domain
   * controllers (Experience, Project, Contact, ...) that were written before this SaaS layer
   * existed can keep calling `user.personId` completely unchanged - they are now guarded by
   * @Roles(Role.CLIENT), which is what makes it safe to assume this is always set when they
   * run. See docs/SAAS-ARCHITECTURE.md "Why personId scoping did not need to change".
   */
  personId: string | null;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>();
    return request.user;
  },
);
