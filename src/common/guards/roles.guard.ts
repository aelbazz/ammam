import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

/**
 * Registered globally, after JwtAuthGuard, in app.module.ts.
 *
 * A route with no @Roles() metadata is allowed for any authenticated caller (JwtAuthGuard
 * has already rejected anonymous ones, unless the route is also @Public()). A route with
 * @Roles(...) requires the caller's role to be in that list, or it is rejected with 403 -
 * this is the actual authorization boundary; nothing in the Angular apps is trusted for it.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException('You do not have permission to perform this action');
    }

    return true;
  }
}
