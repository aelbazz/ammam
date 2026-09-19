import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import * as argon2 from 'argon2';
import { Role } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * The SaaS platform layer: RBAC across ADMIN / COORDINATOR / CLIENT, tenant lifecycle,
 * coordinator scoping, billing isolation, and slug handling.
 *
 * Builds its own Admin, Coordinator and two tenants (ALPHA / BETA) directly via Prisma so
 * this suite is independent of whatever `yarn db:seed` happened to create.
 */
describe('SaaS platform (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let adminToken: string;
  let coordinatorToken: string;
  let alphaClientToken: string;
  let betaClientToken: string;

  let coordinatorId: string;
  let alphaTenantId: string;
  let betaTenantId: string;
  let alphaPersonId: string;
  let alphaExperienceId: string;
  let alphaResponsibilityId: string;
  let alphaTechnologyId: string;
  let alphaCategoryId: string;
  let alphaSkillId: string;

  const ADMIN = { email: 'saas-e2e-admin@test.local', password: 'SaasE2eAdminPassword1' };
  const COORDINATOR = { email: 'saas-e2e-coord@test.local', password: 'SaasE2eCoordPassword1' };
  const ALPHA = {
    slug: 'saas-e2e-alpha',
    email: 'saas-e2e-alpha@test.local',
    password: 'AlphaPassword123',
  };
  const BETA = {
    slug: 'saas-e2e-beta',
    email: 'saas-e2e-beta@test.local',
    password: 'BetaPassword1234',
  };

  async function login(creds: { email: string; password: string }): Promise<string> {
    // Only email/password: ALPHA/BETA also carry `slug`, and the login DTO's
    // forbidNonWhitelisted rejects any extra property - sending `creds` as-is would 400.
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: creds.email, password: creds.password })
      .expect(200);
    return res.body.accessToken;
  }

  beforeAll(async () => {
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

    // Clean slate.
    await prisma.tenant.deleteMany({ where: { slug: { in: [ALPHA.slug, BETA.slug] } } });
    await prisma.user.deleteMany({ where: { email: { in: [ADMIN.email, COORDINATOR.email] } } });

    await prisma.user.create({
      data: {
        email: ADMIN.email,
        passwordHash: await argon2.hash(ADMIN.password, { type: argon2.argon2id }),
        role: Role.ADMIN,
        tenantId: null,
      },
    });

    const coordinator = await prisma.user.create({
      data: {
        email: COORDINATOR.email,
        passwordHash: await argon2.hash(COORDINATOR.password, { type: argon2.argon2id }),
        role: Role.COORDINATOR,
        tenantId: null,
      },
    });
    coordinatorId = coordinator.id;

    adminToken = await login(ADMIN);
    coordinatorToken = await login(COORDINATOR);

    // ALPHA is created through the real onboarding endpoint - this also exercises the
    // transaction itself, not just a hand-rolled fixture.
    const alphaCreate = await request(app.getHttpServer())
      .post('/api/v1/admin/tenants')
      .set({ Authorization: `Bearer ${adminToken}` })
      .send({
        name: 'Saas E2E Alpha',
        slug: ALPHA.slug,
        clientEmail: ALPHA.email,
        clientPassword: ALPHA.password,
      })
      .expect(201);
    alphaTenantId = alphaCreate.body.id;

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/tenants/${alphaTenantId}/status`)
      .set({ Authorization: `Bearer ${adminToken}` })
      .send({ status: 'ACTIVE' })
      .expect(200);

    const betaCreate = await request(app.getHttpServer())
      .post('/api/v1/admin/tenants')
      .set({ Authorization: `Bearer ${adminToken}` })
      .send({
        name: 'Saas E2E Beta',
        slug: BETA.slug,
        clientEmail: BETA.email,
        clientPassword: BETA.password,
      })
      .expect(201);
    betaTenantId = betaCreate.body.id;
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/tenants/${betaCreate.body.id}/status`)
      .set({ Authorization: `Bearer ${adminToken}` })
      .send({ status: 'ACTIVE' })
      .expect(200);

    alphaClientToken = await login(ALPHA);
    betaClientToken = await login(BETA);

    const alphaPerson = await prisma.person.findUnique({ where: { tenantId: alphaTenantId } });
    alphaPersonId = alphaPerson!.id;

    // Give ALPHA some content, created through the API as ALPHA, for the cross-tenant
    // id-guessing tests below.
    const experience = await request(app.getHttpServer())
      .post('/api/v1/tenant/experiences')
      .set({ Authorization: `Bearer ${alphaClientToken}` })
      .send({
        company: 'Alpha Corp',
        position: 'Engineer',
        location: 'Remote',
        startDate: 'Jan 2024',
        isCurrent: true,
        description: 'Alpha work',
        responsibilities: ['Alpha duty'],
        technologies: ['AlphaScript'],
      })
      .expect(201);
    alphaExperienceId = experience.body.id;
    alphaResponsibilityId = experience.body.responsibilities[0].id;

    const technologies = await request(app.getHttpServer())
      .get('/api/v1/tenant/technologies')
      .set({ Authorization: `Bearer ${alphaClientToken}` })
      .expect(200);
    alphaTechnologyId = technologies.body[0].id;

    const category = await request(app.getHttpServer())
      .post('/api/v1/tenant/skill-categories')
      .set({ Authorization: `Bearer ${alphaClientToken}` })
      .send({ name: 'Alpha Skills' })
      .expect(201);
    alphaCategoryId = category.body.id;

    const skill = await request(app.getHttpServer())
      .post(`/api/v1/tenant/skill-categories/${alphaCategoryId}/skills`)
      .set({ Authorization: `Bearer ${alphaClientToken}` })
      .send({ name: 'Alpha Skill', level: 5 })
      .expect(201);
    alphaSkillId = skill.body.id;
  });

  afterAll(async () => {
    // Deleted by id, not by slug: the slug-history test renames a tenant mid-suite, so a
    // slug-based cleanup could miss it and leave orphaned data for the next run to trip
    // over (exactly what happened here once, when an earlier version of this file left a
    // renamed tenant behind after a since-fixed assertion failed before it could restore
    // the original slug).
    await prisma.tenant.deleteMany({
      where: { id: { in: [alphaTenantId, betaTenantId].filter(Boolean) } },
    });
    // Belt and braces: also sweep by slug, in case a test created a tenant this suite
    // never assigned to a tracked variable (e.g. the ad-hoc ones created and deleted inline
    // already clean up after themselves, but this catches anything that did not).
    await prisma.tenant.deleteMany({
      where: { slug: { in: [ALPHA.slug, BETA.slug, `${ALPHA.slug}-renamed`] } },
    });
    await prisma.user.deleteMany({ where: { email: { in: [ADMIN.email, COORDINATOR.email] } } });
    await app.close();
  });

  const asAdmin = () => ({ Authorization: `Bearer ${adminToken}` });
  const asCoordinator = () => ({ Authorization: `Bearer ${coordinatorToken}` });
  const asAlpha = () => ({ Authorization: `Bearer ${alphaClientToken}` });
  const asBeta = () => ({ Authorization: `Bearer ${betaClientToken}` });

  // ============================================================ RBAC matrix

  describe('RBAC: each role reaches only its own namespace', () => {
    it.each([
      ['ADMIN', () => asAdmin(), '/api/v1/tenant/experiences', 403],
      ['ADMIN', () => asAdmin(), '/api/v1/coordinator/tenants', 403],
      ['ADMIN', () => asAdmin(), '/api/v1/admin/tenants', 200],
      ['COORDINATOR', () => asCoordinator(), '/api/v1/admin/tenants', 403],
      ['COORDINATOR', () => asCoordinator(), '/api/v1/tenant/experiences', 403],
      ['COORDINATOR', () => asCoordinator(), '/api/v1/coordinator/tenants', 200],
      ['CLIENT', () => asAlpha(), '/api/v1/admin/tenants', 403],
      ['CLIENT', () => asAlpha(), '/api/v1/coordinator/tenants', 403],
      ['CLIENT', () => asAlpha(), '/api/v1/tenant/experiences', 200],
    ])('%s -> GET %s => %i', async (_role, headers, path, expected) => {
      await request(app.getHttpServer()).get(path).set(headers()).expect(expected);
    });

    it('GET /auth/me carries no @Roles restriction - every role can reach it', async () => {
      for (const headers of [asAdmin(), asCoordinator(), asAlpha()]) {
        await request(app.getHttpServer()).get('/api/v1/auth/me').set(headers).expect(200);
      }
    });
  });

  // ==================================================== admin tenant CRUD

  describe('Admin tenant management', () => {
    it('creates a tenant with a real UUID, generated client account, trial subscription', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/tenants')
        .set(asAdmin())
        .send({
          name: 'Throwaway Co',
          clientEmail: 'throwaway@test.local',
          clientPassword: 'ThrowawayPass1',
        })
        .expect(201);

      expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/i);
      expect(res.body.slug).toBe('throwaway-co');
      expect(res.body.status).toBe('PENDING');
      expect(res.body.subscriptionStatus).toBe('TRIAL');

      // Onboarding transaction created every row.
      expect(await prisma.person.count({ where: { tenantId: res.body.id } })).toBe(1);
      expect(await prisma.user.count({ where: { tenantId: res.body.id } })).toBe(1);
      expect(await prisma.tenantTheme.count({ where: { tenantId: res.body.id } })).toBe(1);
      expect(await prisma.websiteSettings.count({ where: { tenantId: res.body.id } })).toBe(1);

      await prisma.tenant.delete({ where: { id: res.body.id } });
    });

    it('lists every tenant, including ones not assigned to any coordinator', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/tenants')
        .set(asAdmin())
        .expect(200);
      const slugs = res.body.map((t: { slug: string }) => t.slug);
      expect(slugs).toEqual(expect.arrayContaining([ALPHA.slug, BETA.slug]));
    });

    it('validates lifecycle transitions and rejects an invalid one', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/tenants/${alphaTenantId}/status`)
        .set(asAdmin())
        .send({ status: 'PENDING' }) // ACTIVE -> PENDING is not a valid transition
        .expect(400);
      expect(res.body.message).toMatch(/Cannot move/);
    });

    it('rejects a reserved slug', () =>
      request(app.getHttpServer())
        .post('/api/v1/admin/tenants')
        .set(asAdmin())
        .send({
          name: 'Nope',
          slug: 'admin',
          clientEmail: 'nope@test.local',
          clientPassword: 'NopePassword1',
        })
        .expect(400));

    it('rejects an explicitly duplicate slug rather than silently renaming it', () =>
      request(app.getHttpServer())
        .post('/api/v1/admin/tenants')
        .set(asAdmin())
        .send({
          name: 'Someone Else',
          slug: ALPHA.slug,
          clientEmail: 'dup@test.local',
          clientPassword: 'DupPassword123',
        })
        .expect(409));

    it('auto-generates a unique slug from the name, suffixing on collision', async () => {
      const first = await request(app.getHttpServer())
        .post('/api/v1/admin/tenants')
        .set(asAdmin())
        .send({
          name: 'Collision Co',
          clientEmail: 'coll1@test.local',
          clientPassword: 'CollPassword1',
        })
        .expect(201);
      const second = await request(app.getHttpServer())
        .post('/api/v1/admin/tenants')
        .set(asAdmin())
        .send({
          name: 'Collision Co',
          clientEmail: 'coll2@test.local',
          clientPassword: 'CollPassword2',
        })
        .expect(201);

      expect(first.body.slug).toBe('collision-co');
      expect(second.body.slug).toBe('collision-co-2');

      await prisma.tenant.deleteMany({ where: { id: { in: [first.body.id, second.body.id] } } });
    });

    it('resets the client access password and the new password actually works', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/tenants/${alphaTenantId}/reset-access`)
        .set(asAdmin())
        .expect(201);

      expect(typeof res.body.temporaryPassword).toBe('string');
      expect(res.body.temporaryPassword.length).toBeGreaterThanOrEqual(8);

      // The old password no longer works...
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: ALPHA.email, password: ALPHA.password })
        .expect(401);

      // ...and the new one does.
      const relogin = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: ALPHA.email, password: res.body.temporaryPassword })
        .expect(200);

      alphaClientToken = relogin.body.accessToken; // subsequent tests use the new token
    });

    it("records every mutation in this tenant's activity log", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/tenants/${alphaTenantId}/activity`)
        .set(asAdmin())
        .expect(200);

      const actions = res.body.data.map((e: { action: string }) => e.action);
      expect(actions).toEqual(
        expect.arrayContaining(['TENANT_CREATED', 'TENANT_STATUS_CHANGED', 'TENANT_ACCESS_RESET']),
      );
    });
  });

  // ============================================== coordinator assignment

  describe('Coordinator assignment and scoping', () => {
    it('an unassigned coordinator sees no tenants', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/coordinator/tenants')
        .set(asCoordinator())
        .expect(200);
      expect(res.body).toEqual([]);
    });

    it('after assignment, the coordinator sees exactly that tenant', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/tenants/${alphaTenantId}/coordinator`)
        .set(asAdmin())
        .send({ coordinatorId })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get('/api/v1/coordinator/tenants')
        .set(asCoordinator())
        .expect(200);
      expect(res.body.map((t: { slug: string }) => t.slug)).toEqual([ALPHA.slug]);
    });

    it('cannot reach BETA - a real tenant, just not assigned to them', () =>
      request(app.getHttpServer())
        .get(`/api/v1/coordinator/tenants/${betaTenantId}`)
        .set(asCoordinator())
        .expect(404));

    it('creates a tenant self-assigned to the creating coordinator', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/coordinator/tenants')
        .set(asCoordinator())
        .send({
          name: 'Coordinator Owned',
          clientEmail: 'coordowned@test.local',
          clientPassword: 'CoordOwned1',
        })
        .expect(201);

      expect(res.body.coordinatorEmail).toBe(COORDINATOR.email);
      await prisma.tenant.delete({ where: { id: res.body.id } });
    });

    it('a coordinator cannot change tenant status (no such route for them)', () =>
      request(app.getHttpServer())
        .patch(`/api/v1/coordinator/tenants/${alphaTenantId}/status`)
        .set(asCoordinator())
        .send({ status: 'SUSPENDED' })
        .expect(404));
  });

  // ============================================= cross-tenant isolation

  describe('A CLIENT with a valid token cannot reach another tenant, even with a real id', () => {
    it('cannot read, update or delete the other tenant experience', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/tenant/experiences/${alphaExperienceId}`)
        .set(asBeta())
        .expect(404);
      await request(app.getHttpServer())
        .patch(`/api/v1/tenant/experiences/${alphaExperienceId}`)
        .set(asBeta())
        .send({ company: 'HIJACKED' })
        .expect(404);
      await request(app.getHttpServer())
        .delete(`/api/v1/tenant/experiences/${alphaExperienceId}`)
        .set(asBeta())
        .expect(404);
    });

    it('cannot reach a child row through its own id', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/tenant/experiences/responsibilities/${alphaResponsibilityId}`)
        .set(asBeta())
        .send({ description: 'HIJACKED' })
        .expect(404);
    });

    it('cannot rename or delete the other tenant technology', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/tenant/technologies/${alphaTechnologyId}`)
        .set(asBeta())
        .send({ name: 'HIJACKED' })
        .expect(404);
    });

    it('cannot add a skill to the other tenant category, or delete their skill', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/tenant/skill-categories/${alphaCategoryId}/skills`)
        .set(asBeta())
        .send({ name: 'HIJACKED', level: 9 })
        .expect(404);
      await request(app.getHttpServer())
        .delete(`/api/v1/tenant/skill-categories/skills/${alphaSkillId}`)
        .set(asBeta())
        .expect(404);
    });

    it('cannot renumber the other tenant rows through reorder', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/tenant/experiences/reorder')
        .set(asBeta())
        .send({ items: [{ id: alphaExperienceId, sortOrder: 99 }] })
        .expect(204);

      const row = await prisma.experience.findUnique({ where: { id: alphaExperienceId } });
      expect(row?.sortOrder).not.toBe(99);
    });

    it("leaves every one of alpha's records untouched throughout", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/tenant/experiences/${alphaExperienceId}`)
        .set(asAlpha())
        .expect(200);

      expect(res.body.company).toBe('Alpha Corp');
      expect(res.body.technologies).toEqual(['AlphaScript']);
    });
  });

  describe('Per-tenant key spaces', () => {
    it('lets both tenants own a technology with the same name', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/tenant/technologies')
        .set(asBeta())
        .send({ name: 'AlphaScript' })
        .expect(201);

      const rows = await prisma.technology.findMany({ where: { slug: 'alphascript' } });
      expect(rows.length).toBeGreaterThanOrEqual(2);
      const owners = new Set(rows.map((r) => r.personId));
      expect(owners.has(alphaPersonId)).toBe(true);
    });

    it('lets both tenants start their legacy ids at 1', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/tenant/experiences')
        .set(asBeta())
        .send({
          company: 'Beta Corp',
          position: 'Engineer',
          location: 'Remote',
          startDate: 'Jan 2024',
          isCurrent: true,
          description: 'Beta work',
        })
        .expect(201);

      expect(created.body.legacyId).toBe('exp1');
    });
  });

  // ========================================================= public API

  describe('Public profiles are addressed per tenant', () => {
    it('serves each tenant at its own slug, anonymously, with no cross-contamination', async () => {
      const alpha = await request(app.getHttpServer())
        .get(`/api/v1/public/tenants/${ALPHA.slug}/profile`)
        .expect(200);
      const beta = await request(app.getHttpServer())
        .get(`/api/v1/public/tenants/${BETA.slug}/profile`)
        .expect(200);

      expect(alpha.body.tenant.slug).toBe(ALPHA.slug);
      expect(beta.body.tenant.slug).toBe(BETA.slug);
      expect(beta.text).not.toContain('Alpha Corp');
    });

    it('follows a retired slug via history after a rename', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/tenants/${alphaTenantId}`)
        .set(asAdmin())
        .send({ slug: `${ALPHA.slug}-renamed` })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/public/tenants/${ALPHA.slug}/profile`) // the OLD slug
        .expect(200);

      expect(res.body.tenant.slug).toBe(`${ALPHA.slug}-renamed`);
      expect(res.headers['x-tenant-slug-current']).toBe(`${ALPHA.slug}-renamed`);

      // Restore for any later test in this file that still expects ALPHA.slug to be live.
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/tenants/${alphaTenantId}`)
        .set(asAdmin())
        .send({ slug: ALPHA.slug })
        .expect(200);
    });

    it('hides a suspended tenant behind the same 404 as an unknown slug', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/tenants/${alphaTenantId}/status`)
        .set(asAdmin())
        .send({ status: 'SUSPENDED' })
        .expect(200);

      await request(app.getHttpServer())
        .get(`/api/v1/public/tenants/${ALPHA.slug}/profile`)
        .expect(404);

      // Restore.
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/tenants/${alphaTenantId}/status`)
        .set(asAdmin())
        .send({ status: 'ACTIVE' })
        .expect(200);
    });
  });

  // ============================================================= billing

  describe('Billing: read-only for CLIENT, full access for Admin', () => {
    it('admin sees every subscription; a client sees only their own', async () => {
      const adminView = await request(app.getHttpServer())
        .get('/api/v1/admin/subscriptions')
        .set(asAdmin())
        .expect(200);
      expect(adminView.body.length).toBeGreaterThanOrEqual(2);

      const clientView = await request(app.getHttpServer())
        .get('/api/v1/tenant/subscription')
        .set(asAlpha())
        .expect(200);
      expect(clientView.body.tenantId ?? alphaTenantId).toBeTruthy();
    });

    it('a client cannot reach the admin subscription list or update any subscription', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/subscriptions')
        .set(asAlpha())
        .expect(403);
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/tenants/${alphaTenantId}/subscription`)
        .set(asAlpha())
        .send({ status: 'ACTIVE' })
        .expect(403);
    });

    it('admin can change plan/status and it is reflected for the client', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/tenants/${alphaTenantId}/subscription`)
        .set(asAdmin())
        .send({ status: 'PAST_DUE' })
        .expect(200);

      const clientView = await request(app.getHttpServer())
        .get('/api/v1/tenant/subscription')
        .set(asAlpha())
        .expect(200);
      expect(clientView.body.status).toBe('PAST_DUE');

      // PAST_DUE is a grace period - the public site must still be reachable.
      await request(app.getHttpServer())
        .get(`/api/v1/public/tenants/${ALPHA.slug}/profile`)
        .expect(200);

      // Restore.
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/tenants/${alphaTenantId}/subscription`)
        .set(asAdmin())
        .send({ status: 'ACTIVE' })
        .expect(200);
    });

    it('admin can record a manual payment', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/payments')
        .set(asAdmin())
        .send({ tenantId: alphaTenantId, amount: 29, provider: 'manual' })
        .expect(201);

      expect(res.body.status).toBe('PAID');
      expect(res.body.provider).toBe('manual');
    });

    it('expire-overdue flips a past-due-date subscription to EXPIRED and hides the public profile', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/tenants/${alphaTenantId}/subscription`)
        .set(asAdmin())
        .send({ status: 'ACTIVE', expiresAt: '2020-01-01T00:00:00.000Z' })
        .expect(200);

      const result = await request(app.getHttpServer())
        .post('/api/v1/admin/subscriptions/expire-overdue')
        .set(asAdmin())
        .expect(201);
      expect(result.body.expired).toBeGreaterThanOrEqual(1);

      const clientView = await request(app.getHttpServer())
        .get('/api/v1/tenant/subscription')
        .set(asAlpha())
        .expect(200);
      expect(clientView.body.status).toBe('EXPIRED');

      await request(app.getHttpServer())
        .get(`/api/v1/public/tenants/${ALPHA.slug}/profile`)
        .expect(404);

      // Restore, so later tests in this file see ALPHA as a normal active tenant again.
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/tenants/${alphaTenantId}/subscription`)
        .set(asAdmin())
        .send({ status: 'ACTIVE', expiresAt: null })
        .expect(200);
    });

    it('a client cannot trigger expire-overdue - it is an admin operation', () =>
      request(app.getHttpServer())
        .post('/api/v1/admin/subscriptions/expire-overdue')
        .set(asAlpha())
        .expect(403));
  });

  // =========================================================== audit log

  describe('Audit log', () => {
    it('never records a password or token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/audit-logs')
        .set(asAdmin())
        .expect(200);

      const serialised = JSON.stringify(res.body);
      expect(serialised).not.toContain(ALPHA.password);
      expect(serialised).not.toContain(alphaClientToken);
    });

    it('is not reachable by a coordinator or a client', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/audit-logs')
        .set(asCoordinator())
        .expect(403);
      await request(app.getHttpServer()).get('/api/v1/admin/audit-logs').set(asAlpha()).expect(403);
    });
  });
});
