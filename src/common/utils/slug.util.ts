/**
 * Reserved path segments. A tenant slug can never equal one of these, because the public
 * site is served at the bare root (/:tenantSlug) - a tenant named "admin" or "login" would
 * collide with a real platform route. Kept as one list, consulted everywhere a slug is
 * validated, rather than duplicated per call site.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  'admin',
  'coordinator',
  'client',
  'login',
  'register',
  'logout',
  'api',
  'auth',
  'assets',
  'settings',
  'dashboard',
  'favicon',
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
  'public',
  'health',
  'docs',
  'www',
  'app',
  'static',
  'profile',
]);

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$|^[a-z0-9]$/;
const MAX_SLUG_LENGTH = 63;

/**
 * Normalises a candidate slug: lower-case, ASCII, words joined by single hyphens, no
 * leading/trailing hyphen. Same normalisation for a user-supplied slug and one generated
 * from a tenant name, so both paths produce identical results for identical input.
 */
export function normalizeSlug(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics: "José" -> "Jose"
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, '');
}

/** True for a slug that is syntactically valid - says nothing about availability. */
export function isValidSlugFormat(slug: string): boolean {
  return SLUG_PATTERN.test(slug) && !RESERVED_SLUGS.has(slug);
}

/**
 * Generates the slug fallback strings to try in order when a candidate is taken:
 * "john-doe", "john-doe-2", "john-doe-3", ... The caller stops at the first one whose
 * availability check (DB lookup across Tenant.slug and TenantSlugHistory.slug) passes.
 */
export function* slugCandidates(base: string): Generator<string> {
  const normalized = normalizeSlug(base) || 'tenant';
  yield normalized;
  for (let n = 2; n < 1000; n++) {
    yield `${normalized}-${n}`;
  }
}
