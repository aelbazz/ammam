import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as reachable without a JWT. The global JwtAuthGuard denies everything by
 * default, so authentication is opt-out rather than opt-in - forgetting a guard cannot
 * accidentally expose a mutation endpoint.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
