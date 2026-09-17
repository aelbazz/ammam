import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import * as argon2 from 'argon2';
import { Role } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * End-to-end tests against a real PostgreSQL instance, covering the CLIENT-facing surface:
 * health, auth, the public profile for one tenant, and CRUD under /tenant/*.
 *
 * Builds its own tenant + CLIENT fixture directly via Prisma rather than depending on
 * `yarn db:seed` having run with any particular credentials - the seed script's job is to
 * import real profile data for production, not to hand this suite its test accounts.
 * Cross-tenant isolation, RBAC across every role, and platform (Admin/Coordinator/billing)
 * behaviour are covered separately in test/saas.e2e-spec.ts.
 */
describe('Profile API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let personId: string;
  let tenantSlug: string;

  const FIXTURE_SLUG = 'app-e2e-fixture';
  const CLIENT_EMAIL = 'app-e2e-client@test.local';
  const CLIENT_PASSWORD = 'AppE2eClientPassword123';

  beforeAll(async () => {
    // Throttle budgets are raised in test/setup-e2e.ts, which runs before AppModule is
    // imported - the @Throttle decorator reads the env var at class-load time.
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );

    await app.init();
    prisma = app.get(PrismaService);

    // Clean slate in case a previous run was interrupted.
    await prisma.tenant.deleteMany({ where: { slug: FIXTURE_SLUG } });

    const tenant = await prisma.tenant.create({
      data: { slug: FIXTURE_SLUG, name: 'App E2E Fixture', status: 'ACTIVE' },
    });
    const person = await prisma.person.create({
      data: {
        tenantId: tenant.id,
        name: 'App E2E Fixture',
        title: 'Title',
        summary: 'Summary',
        location: 'Location',
        yearsOfExperience: 1,
        avatar: '/assets/images/profile-image.jpg',
        tagline: 'Tagline',
      },
    });
    await prisma.user.create({
      data: {
        email: CLIENT_EMAIL,
        passwordHash: await argon2.hash(CLIENT_PASSWORD, { type: argon2.argon2id }),
        name: 'Fixture Client',
        role: Role.CLIENT,
        tenantId: tenant.id,
      },
    });
    const plan = await prisma.plan.upsert({
      where: { id: 'plan_free_default' },
      create: {
        id: 'plan_free_default',
        name: 'Free',
        price: 0,
        currency: 'USD',
        billingInterval: 'MONTHLY',
        active: true,
        features: [],
      },
      update: {},
    });
    await prisma.subscription.create({
      data: { tenantId: tenant.id, planId: plan.id, status: 'ACTIVE', autoRenew: false },
    });
    await prisma.tenantTheme.create({ data: { tenantId: tenant.id } });
    await prisma.websiteSettings.create({
      data: { tenantId: tenant.id, websiteTitle: 'App E2E Fixture' },
    });

    personId = person.id;
    tenantSlug = tenant.slug;

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: CLIENT_EMAIL, password: CLIENT_PASSWORD });
    token = res.body.accessToken;
  });

  afterAll(async () => {
    await prisma.tenant.deleteMany({ where: { slug: FIXTURE_SLUG } });
    await app.close();
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  // ---------------------------------------------------------------- health

  describe('GET /api/v1/health', () => {
    it('reports healthy with a live database check', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.info.database.status).toBe('up');
    });
  });

  // ------------------------------------------------------------------ auth

  describe('Authentication', () => {
    it('issues a token for valid credentials, identifying the CLIENT role and tenant', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: CLIENT_EMAIL, password: CLIENT_PASSWORD })
        .expect(200);

      expect(typeof res.body.accessToken).toBe('string');
      expect(res.body.user.email).toBe(CLIENT_EMAIL);
      expect(res.body.user.role).toBe('CLIENT');
      expect(res.body.user.tenantSlug).toBe(FIXTURE_SLUG);
      expect(res.body.user).not.toHaveProperty('passwordHash');
    });

    it('rejects a wrong password', () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: CLIENT_EMAIL, password: 'definitely-wrong' })
        .expect(401));

    it('rejects an unknown email', () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@example.com', password: 'definitely-wrong' })
        .expect(401));

    it('rejects a malformed body with 400, not 401', () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'not-an-email', password: 'x' })
        .expect(400));

    it('strips unknown properties instead of accepting them', () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: CLIENT_EMAIL, password: CLIENT_PASSWORD, role: 'ADMIN' })
        .expect(400));

    it('rejects /auth/me without a token', () =>
      request(app.getHttpServer()).get('/api/v1/auth/me').expect(401));

    it('rejects /auth/me with a garbage token', () =>
      request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set({ Authorization: 'Bearer not.a.real.token' })
        .expect(401));

    it('returns the current user for a valid token, with no @Roles restriction', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/auth/me').set(auth()).expect(200);

      expect(res.body.email).toBe(CLIENT_EMAIL);
      expect(res.body).not.toHaveProperty('passwordHash');
    });
  });

  // -------------------------------------------------------- public profile

  describe('GET /api/v1/public/tenants/:tenantSlug/profile', () => {
    it('is reachable anonymously and returns the whole profile for this tenant', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/public/tenants/${tenantSlug}/profile`)
        .expect(200);

      expect(Object.keys(res.body)).toEqual([
        'tenant',
        'person',
        'contact',
        'experiences',
        'projects',
        'achievements',
        'courses',
        'timelineEvents',
        'managementRoles',
        'skills',
        'theme',
        'settings',
      ]);
      expect(res.body.tenant).toEqual({ slug: FIXTURE_SLUG, name: 'App E2E Fixture' });
    });

    it('exposes no administrative or database metadata', async () => {
      const { text } = await request(app.getHttpServer()).get(
        `/api/v1/public/tenants/${tenantSlug}/profile`,
      );

      expect(text).not.toContain('passwordHash');
      expect(text).not.toContain('isPublished');
      expect(text).not.toContain('sortOrder');
      expect(text).not.toContain('personId');
      expect(text).not.toContain(personId); // the internal Person id itself
    });

    it('sets caching headers and honours If-None-Match', async () => {
      const first = await request(app.getHttpServer())
        .get(`/api/v1/public/tenants/${tenantSlug}/profile`)
        .expect(200);

      expect(first.headers.etag).toBeDefined();
      expect(first.headers['last-modified']).toBeDefined();
      // no-cache, not max-age: an edit must be visible immediately, with the ETag keeping
      // that revalidation cheap.
      expect(first.headers['cache-control']).toContain('no-cache');

      await request(app.getHttpServer())
        .get(`/api/v1/public/tenants/${tenantSlug}/profile`)
        .set({ 'If-None-Match': first.headers.etag })
        .expect(304);
    });

    it('404s for an unregistered slug', () =>
      request(app.getHttpServer())
        .get('/api/v1/public/tenants/no-such-tenant/profile')
        .expect(404));
  });

  // ------------------------------------------------------------- security

  describe('Protected endpoints reject anonymous callers', () => {
    const cases: Array<[string, string]> = [
      ['post', '/api/v1/tenant/experiences'],
      ['patch', '/api/v1/tenant/experiences/some-id'],
      ['delete', '/api/v1/tenant/experiences/some-id'],
      ['post', '/api/v1/tenant/projects'],
      ['get', '/api/v1/tenant/technologies'],
      ['patch', '/api/v1/tenant/profile'],
      ['patch', '/api/v1/tenant/contact'],
      ['post', '/api/v1/tenant/achievements'],
      ['post', '/api/v1/tenant/courses'],
      ['post', '/api/v1/tenant/timeline-events'],
      ['post', '/api/v1/tenant/management-roles'],
      ['post', '/api/v1/tenant/skill-categories'],
      ['get', '/api/v1/tenant/theme'],
      ['get', '/api/v1/tenant/settings'],
      ['get', '/api/v1/admin/tenants'],
      ['get', '/api/v1/coordinator/tenants'],
    ];

    it.each(cases)('%s %s -> 401', async (method, path) => {
      const server = request(app.getHttpServer());
      await (server as unknown as Record<string, (p: string) => request.Test>)
        [method](path)
        .send({})
        .expect(401);
    });

    it('does not mutate data when the token is missing', async () => {
      const before = await prisma.person.findUnique({ where: { id: personId } });
      await request(app.getHttpServer())
        .patch('/api/v1/tenant/profile')
        .send({ name: 'Intruder' })
        .expect(401);
      const after = await prisma.person.findUnique({ where: { id: personId } });

      expect(after?.name).toBe(before?.name);
    });
  });

  // ----------------------------------------------------------------- CRUD

  describe('Experience CRUD', () => {
    let createdId: string;

    it('creates an experience with nested children', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/tenant/experiences')
        .set(auth())
        .send({
          company: 'E2E Test Co',
          position: 'Engineer',
          location: 'Remote',
          startDate: 'Jan 2026',
          isCurrent: true,
          description: 'Created by the e2e suite',
          responsibilities: ['First duty', 'Second duty'],
          technologies: ['Angular', 'A Brand New Technology'],
        })
        .expect(201);

      createdId = res.body.id;
      expect(res.body.legacyId).toMatch(/^exp\d+$/);
      expect(res.body.responsibilities).toHaveLength(2);
      expect(res.body.technologies).toEqual(['Angular', 'A Brand New Technology']);
    });

    it('rejects unknown properties', () =>
      request(app.getHttpServer())
        .post('/api/v1/tenant/experiences')
        .set(auth())
        .send({
          company: 'X',
          position: 'Y',
          location: 'Z',
          startDate: '2020',
          isCurrent: false,
          description: 'd',
          notAField: 'boom',
        })
        .expect(400));

    it('leaves children untouched when they are omitted from a PATCH', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/tenant/experiences/${createdId}`)
        .set(auth())
        .send({ position: 'Senior Engineer' })
        .expect(200);

      expect(res.body.position).toBe('Senior Engineer');
      expect(res.body.responsibilities).toHaveLength(2);
    });

    it('replaces children when they are sent explicitly', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/tenant/experiences/${createdId}`)
        .set(auth())
        .send({ responsibilities: ['Only one now'] })
        .expect(200);

      expect(res.body.responsibilities).toHaveLength(1);
    });

    it('attaches a technology by name without duplicating it', async () => {
      const before = await prisma.technology.count({ where: { slug: 'typescript', personId } });
      await request(app.getHttpServer())
        .post(`/api/v1/tenant/experiences/${createdId}/technologies`)
        .set(auth())
        .send({ name: 'typescript' })
        .expect(201);

      const after = await prisma.technology.count({ where: { slug: 'typescript', personId } });
      expect(after).toBe(Math.max(before, 1));
    });

    it('returns 404 for an unknown id', () =>
      request(app.getHttpServer())
        .get('/api/v1/tenant/experiences/does-not-exist')
        .set(auth())
        .expect(404));

    it('deletes the experience and cascades to its children', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/tenant/experiences/${createdId}`)
        .set(auth())
        .expect(204);

      expect(
        await prisma.experienceResponsibility.count({ where: { experienceId: createdId } }),
      ).toBe(0);
    });
  });

  describe('Technology CRUD', () => {
    it('lists technologies with usage counts', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/tenant/technologies')
        .set(auth())
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('creating an existing technology returns the existing row, scoped to this tenant', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/tenant/technologies')
        .set(auth())
        .send({ name: 'Angular' })
        .expect(201);

      const before = await prisma.technology.count({ where: { slug: 'angular', personId } });

      await request(app.getHttpServer())
        .post('/api/v1/tenant/technologies')
        .set(auth())
        .send({ name: 'ANGULAR' })
        .expect(201);

      expect(await prisma.technology.count({ where: { slug: 'angular', personId } })).toBe(before);
    });
  });

  describe('Profile and contact singletons', () => {
    it('reads and updates the profile', async () => {
      const before = (await request(app.getHttpServer()).get('/api/v1/tenant/profile').set(auth()))
        .body.tagline;

      await request(app.getHttpServer())
        .patch('/api/v1/tenant/profile')
        .set(auth())
        .send({ tagline: 'Changed by e2e' })
        .expect(200);

      const changed = (await request(app.getHttpServer()).get('/api/v1/tenant/profile').set(auth()))
        .body.tagline;
      expect(changed).toBe('Changed by e2e');
      expect(changed).not.toBe(before);
    });

    it('reads the contact with its social links', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/tenant/contact')
        .set(auth())
        .expect(404); // no contact created for this fixture tenant yet

      expect(res.body.message).toBeDefined();
    });
  });

  describe('Theme and website settings', () => {
    it('reads and updates the theme', async () => {
      const before = await request(app.getHttpServer())
        .get('/api/v1/tenant/theme')
        .set(auth())
        .expect(200);
      expect(before.body.primaryColor).toBe('#6366f1');

      const updated = await request(app.getHttpServer())
        .patch('/api/v1/tenant/theme')
        .set(auth())
        .send({ primaryColor: '#123456', darkMode: true })
        .expect(200);
      expect(updated.body.primaryColor).toBe('#123456');
      expect(updated.body.darkMode).toBe(true);
    });

    it('rejects an invalid color', () =>
      request(app.getHttpServer())
        .patch('/api/v1/tenant/theme')
        .set(auth())
        .send({ primaryColor: 'not-a-color' })
        .expect(400));

    it('reads website settings with default section arrays', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/tenant/settings')
        .set(auth())
        .expect(200);

      expect(res.body.visibleSections).toContain('experience');
      expect(res.body.sectionOrder.length).toBe(res.body.visibleSections.length);
    });
  });

  describe('Subscription (read-only for CLIENT)', () => {
    it('shows my own subscription', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/tenant/subscription')
        .set(auth())
        .expect(200);
      expect(res.body.status).toBe('ACTIVE');
      expect(res.body.planName).toBe('Free');
    });

    it('has no write endpoint reachable by a CLIENT', () =>
      request(app.getHttpServer())
        .patch(`/api/v1/admin/tenants/some-id/status`)
        .set(auth())
        .send({ status: 'SUSPENDED' })
        .expect(403));
  });
});
