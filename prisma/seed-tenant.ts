/**
 * Creates an additional empty tenant with its own administrator.
 *
 * Every profile is a tenant, so onboarding a second person means creating a Person row and
 * an AdminUser bound to it. That admin then sees an empty portfolio and fills it in through
 * the admin UI - no data is copied from anyone else.
 *
 * Usage:
 *   TENANT_SLUG=jane TENANT_NAME='Jane Doe' \
 *   TENANT_ADMIN_EMAIL=jane@example.com TENANT_ADMIN_PASSWORD='...' \
 *   yarn tenant:create
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

function required(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) {
    throw new Error(`${name} is required.`);
  }
  return value.trim();
}

async function main(): Promise<void> {
  const slug = required('TENANT_SLUG').toLowerCase();
  const name = required('TENANT_NAME');
  const email = required('TENANT_ADMIN_EMAIL').toLowerCase();
  const password = required('TENANT_ADMIN_PASSWORD');

  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    throw new Error('TENANT_SLUG must be lowercase letters, digits and hyphens.');
  }
  if (password.length < 12) {
    throw new Error('TENANT_ADMIN_PASSWORD must be at least 12 characters.');
  }

  const existing = await prisma.person.findUnique({ where: { slug } });
  if (existing) {
    throw new Error(`A profile already exists at "${slug}".`);
  }

  // Placeholder content only - the new admin replaces all of it. Nothing here claims to be
  // real professional information about anyone.
  const person = await prisma.person.create({
    data: {
      slug,
      name,
      title: 'Add your professional title',
      summary: 'Add a short professional summary.',
      location: 'Add your location',
      yearsOfExperience: 0,
      avatar: '/assets/images/profile-image.jpg',
      tagline: 'Add a tagline',
    },
  });

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  await prisma.adminUser.create({
    data: { email, passwordHash, name: `${name} (admin)`, personId: person.id },
  });

  // The email and password are deliberately not logged.
  console.log(`\nTenant created.`);
  console.log(`  profile slug : ${slug}`);
  console.log(`  public URL   : /api/v1/public/profile/${slug}`);
  console.log(`  admin        : sign in at /admin with the email you supplied\n`);
}

main()
  .catch((error) => {
    console.error('\nFailed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
