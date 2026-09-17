import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  /** Tenant scope. Every admin query is filtered by this; it is never client-supplied. */
  personId: string;
  /** Tenant's public slug, echoed to the admin UI so it can show which profile is open. */
  personSlug: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>();
    return request.user;
  },
);
