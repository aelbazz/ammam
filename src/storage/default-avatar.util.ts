import { ConfigService } from '@nestjs/config';

/**
 * The built-in default avatar's absolute URL - served as a static asset (see main.ts's
 * useStaticAssets), never stored in the database. Shared by TenantService (onboarding) and
 * AvatarService (fallback on removal) so a new tenant's Person.avatar and a post-removal
 * avatar always agree on the same URL.
 */
export function defaultAvatarUrl(config: ConfigService): string {
  const base =
    config.get<string>('API_PUBLIC_URL') ?? `http://localhost:${config.get('PORT') ?? 3000}`;
  return `${base}/assets/default-avatar.svg`;
}
