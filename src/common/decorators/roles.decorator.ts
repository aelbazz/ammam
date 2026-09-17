import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Restricts a route to the listed roles. Enforced by RolesGuard, registered globally
 * alongside JwtAuthGuard - so this is a backend authorization boundary, not a UI hint.
 *
 * A route with no @Roles() at all is reachable by any authenticated user regardless of
 * role (e.g. GET /auth/me). Every tenant-scoped, coordinator-scoped and admin-scoped
 * controller in this codebase carries one.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
