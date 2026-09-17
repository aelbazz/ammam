import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * End-to-end tests against a real PostgreSQL instance.
 *
 * Requires DATABASE_URL to point at a migrated + seeded database:
 *   docker compose up -d && yarn prisma:deploy && yarn db:seed
 */
describe('Profile API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  /** The tenant this suite's administrator manages. Technologies are per-tenant, so any
   *  "exactly one Angular" assertion has to be scoped to it - other tenants may own one. */
  let personId: string;

  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@localhost.dev';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'LocalDevAdmin!2026';

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

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: adminPassword });
    token = res.body.accessToken;
    personId = res.body.user.personId;
  });

  afterAll(async () => {
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
    it('issues a token for valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: adminEmail, password: adminPassword })
        .expect(200);

      expect(typeof res.body.accessToken).toBe('string');
      expect(res.body.user.email).toBe(adminEmail);
      expect(res.body.user).not.toHaveProperty('passwordHash');
    });

    it('rejects a wrong password', () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: adminEmail, password: 'definitely-wrong' })
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
        .send({ email: adminEmail, password: adminPassword, isAdmin: true })
        .expect(400));

    it('rejects /auth/me without a token', () =>
      request(app.getHttpServer()).get('/api/v1/auth/me').expect(401));

    it('rejects /auth/me with a garbage token', () =>
      request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set({ Authorization: 'Bearer not.a.real.token' })
        .expect(401));

    it('returns the current admin for a valid token', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/auth/me').set(auth()).expect(200);

      expect(res.body.email).toBe(adminEmail);
      expect(res.body).not.toHaveProperty('passwordHash');
    });
  });

  // -------------------------------------------------------- public profile

  describe('GET /api/v1/public/profile', () => {
    it('is reachable anonymously and returns the whole profile', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/public/profile').expect(200);

      expect(Object.keys(res.body)).toEqual([
        'person',
        'contact',
        'experiences',
        'projects',
        'achievements',
        'courses',
        'timelineEvents',
        'managementRoles',
        'skills',
      ]);
    });

    it('includes relationships nested under their parents', async () => {
      const { body } = await request(app.getHttpServer()).get('/api/v1/public/profile');
      const experience = body.experiences[0];
      const project = body.projects[0];

      expect(Array.isArray(experience.responsibilities)).toBe(true);
      expect(typeof experience.responsibilities[0]).toBe('string');
      expect(Array.isArray(experience.technologies)).toBe(true);
      expect(Array.isArray(project.highlights)).toBe(true);
      expect(typeof project.highlights[0]).toBe('string');
    });

    it('returns technologies without duplicates within a record', async () => {
      const { body } = await request(app.getHttpServer()).get('/api/v1/public/profile');

      for (const experience of body.experiences) {
        expect(new Set(experience.technologies).size).toBe(experience.technologies.length);
      }
      for (const project of body.projects) {
        expect(new Set(project.technologies).size).toBe(project.technologies.length);
      }
    });

    it('preserves the seeded display order', async () => {
      const { body } = await request(app.getHttpServer()).get('/api/v1/public/profile');
      expect(body.experiences.map((e: { id: string }) => e.id).slice(0, 3)).toEqual([
        'exp1',
        'exp2',
        'exp3',
      ]);
      expect(body.projects[0].id).toBe('proj1');
    });

    it('exposes no administrative or database metadata', async () => {
      const { text } = await request(app.getHttpServer()).get('/api/v1/public/profile');

      expect(text).not.toContain('passwordHash');
      expect(text).not.toContain('isPublished');
      expect(text).not.toContain('sortOrder');
      expect(text).not.toContain('personId');
      expect(text).not.toContain('createdAt');
    });

    it('sets caching headers and honours If-None-Match', async () => {
      const first = await request(app.getHttpServer()).get('/api/v1/public/profile').expect(200);

      expect(first.headers.etag).toBeDefined();
      expect(first.headers['last-modified']).toBeDefined();
      // no-cache, not max-age: the payload must revalidate so an admin edit is visible
      // immediately, with the ETag keeping that revalidation cheap.
      expect(first.headers['cache-control']).toContain('no-cache');

      await request(app.getHttpServer())
        .get('/api/v1/public/profile')
        .set({ 'If-None-Match': first.headers.etag })
        .expect(304);
    });

    it('returns 200 for a stale validator', () =>
      request(app.getHttpServer())
        .get('/api/v1/public/profile')
        .set({ 'If-None-Match': '"not-the-current-etag"' })
        .expect(200));

    it('hides unpublished rows from the public payload', async () => {
      const experience = await prisma.experience.findFirst({ orderBy: { sortOrder: 'desc' } });
      if (!experience) throw new Error('Seed the database before running e2e tests');

      await prisma.experience.update({
        where: { id: experience.id },
        data: { isPublished: false },
      });

      try {
        const { body } = await request(app.getHttpServer()).get('/api/v1/public/profile');
        const ids = body.experiences.map((e: { id: string }) => e.id);
        expect(ids).not.toContain(experience.legacyId);
      } finally {
        await prisma.experience.update({
          where: { id: experience.id },
          data: { isPublished: true },
        });
      }
    });

    it('still lists unpublished rows for the admin, so they can be restored', async () => {
      const experience = await prisma.experience.findFirst({ orderBy: { sortOrder: 'desc' } });
      if (!experience) throw new Error('Seed the database before running e2e tests');

      await prisma.experience.update({
        where: { id: experience.id },
        data: { isPublished: false },
      });

      try {
        const { body } = await request(app.getHttpServer())
          .get('/api/v1/experiences')
          .set(auth())
          .expect(200);

        const row = body.find((e: { id: string }) => e.id === experience.id);
        expect(row).toBeDefined();
        expect(row.isPublished).toBe(false);
      } finally {
        await prisma.experience.update({
          where: { id: experience.id },
          data: { isPublished: true },
        });
      }
    });
  });

  // ------------------------------------------------------------- security

  describe('Protected endpoints reject anonymous callers', () => {
    const cases: Array<[string, string]> = [
      ['post', '/api/v1/experiences'],
      ['patch', '/api/v1/experiences/some-id'],
      ['delete', '/api/v1/experiences/some-id'],
      ['post', '/api/v1/projects'],
      ['delete', '/api/v1/projects/some-id'],
      ['post', '/api/v1/technologies'],
      ['delete', '/api/v1/technologies/some-id'],
      ['patch', '/api/v1/person'],
      ['patch', '/api/v1/contact'],
      ['post', '/api/v1/achievements'],
      ['post', '/api/v1/courses'],
      ['post', '/api/v1/timeline-events'],
      ['post', '/api/v1/management-roles'],
      ['post', '/api/v1/skill-categories'],
    ];

    it.each(cases)('%s %s -> 401', async (method, path) => {
      const server = request(app.getHttpServer());
      await (server as unknown as Record<string, (p: string) => request.Test>)
        [method](path)
        .send({})
        .expect(401);
    });

    it('rejects anonymous reads of admin collections', async () => {
      // The public site reads /public/profile only; these exist for the admin.
      for (const path of [
        '/api/v1/experiences',
        '/api/v1/projects',
        '/api/v1/technologies',
        '/api/v1/person',
        '/api/v1/contact',
        '/api/v1/skill-categories',
      ]) {
        await request(app.getHttpServer()).get(path).expect(401);
      }
    });

    it('does not mutate data when the token is missing', async () => {
      const before = await prisma.person.findUnique({ where: { slug: 'default' } });
      await request(app.getHttpServer())
        .patch('/api/v1/person')
        .send({ name: 'Intruder' })
        .expect(401);
      const after = await prisma.person.findUnique({ where: { slug: 'default' } });

      expect(after?.name).toBe(before?.name);
    });
  });

  // ----------------------------------------------------------------- CRUD

  describe('Experience CRUD', () => {
    let createdId: string;

    it('creates an experience with nested children', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/experiences')
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
      expect(res.body.responsibilities[0].description).toBe('First duty');
      expect(res.body.technologies).toEqual(['Angular', 'A Brand New Technology']);
    });

    it('reuses this tenant existing Angular technology instead of duplicating it', async () => {
      const matches = await prisma.technology.findMany({ where: { slug: 'angular', personId } });
      expect(matches).toHaveLength(1);
    });

    it('rejects unknown properties', () =>
      request(app.getHttpServer())
        .post('/api/v1/experiences')
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

    it('rejects a missing required field', () =>
      request(app.getHttpServer())
        .post('/api/v1/experiences')
        .set(auth())
        .send({ company: 'Missing the rest' })
        .expect(400));

    it('leaves children untouched when they are omitted from a PATCH', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/experiences/${createdId}`)
        .set(auth())
        .send({ position: 'Senior Engineer' })
        .expect(200);

      expect(res.body.position).toBe('Senior Engineer');
      expect(res.body.responsibilities).toHaveLength(2);
    });

    it('replaces children when they are sent explicitly', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/experiences/${createdId}`)
        .set(auth())
        .send({ responsibilities: ['Only one now'] })
        .expect(200);

      expect(res.body.responsibilities).toHaveLength(1);
      expect(res.body.responsibilities[0].description).toBe('Only one now');
    });

    it('adds a responsibility through the nested endpoint', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/experiences/${createdId}/responsibilities`)
        .set(auth())
        .send({ description: 'Added separately' })
        .expect(201);

      expect(res.body.description).toBe('Added separately');
      expect(res.body.sortOrder).toBe(1);
    });

    it('attaches a technology by name without duplicating it', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/experiences/${createdId}/technologies`)
        .set(auth())
        .send({ name: 'typescript' })
        .expect(201);

      expect(res.body.technologies).toContain('TypeScript');
      expect(await prisma.technology.count({ where: { slug: 'typescript', personId } })).toBe(1);
    });

    it('returns 404 for an unknown id', () =>
      request(app.getHttpServer())
        .get('/api/v1/experiences/does-not-exist')
        .set(auth())
        .expect(404));

    it('deletes the experience and cascades to its children', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/experiences/${createdId}`)
        .set(auth())
        .expect(204);

      expect(
        await prisma.experienceResponsibility.count({ where: { experienceId: createdId } }),
      ).toBe(0);
    });

    it('leaves the reusable technologies in place after the experience is deleted', async () => {
      expect(await prisma.technology.count({ where: { slug: 'angular', personId } })).toBe(1);
    });
  });

  describe('Technology CRUD', () => {
    it('lists technologies with usage counts', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/technologies')
        .set(auth())
        .expect(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty('experienceCount');
    });

    it('creating an existing technology returns the existing row', async () => {
      const before = await prisma.technology.count({ where: { personId } });
      const res = await request(app.getHttpServer())
        .post('/api/v1/technologies')
        .set(auth())
        .send({ name: 'ANGULAR' })
        .expect(201);

      expect(res.body.slug).toBe('angular');
      expect(await prisma.technology.count({ where: { personId } })).toBe(before);
    });

    it('cleans up the technology the CRUD test invented', async () => {
      // Technology is now keyed per tenant, so a bare slug is no longer a unique key.
      const invented = await prisma.technology.findFirst({
        where: { slug: 'a-brand-new-technology', personId },
      });
      if (invented) {
        await request(app.getHttpServer())
          .delete(`/api/v1/technologies/${invented.id}`)
          .set(auth())
          .expect(204);
      }
      expect(
        await prisma.technology.findFirst({ where: { slug: 'a-brand-new-technology', personId } }),
      ).toBeNull();
    });
  });

  describe('Person and contact singletons', () => {
    it('reads the person', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/person').set(auth()).expect(200);
      expect(res.body.name).toBeTruthy();
    });

    it('updates and restores the tagline', async () => {
      const before = (await request(app.getHttpServer()).get('/api/v1/person').set(auth())).body
        .tagline;

      await request(app.getHttpServer())
        .patch('/api/v1/person')
        .set(auth())
        .send({ tagline: 'Temporarily changed by e2e' })
        .expect(200);

      const changed = (await request(app.getHttpServer()).get('/api/v1/person').set(auth())).body
        .tagline;
      expect(changed).toBe('Temporarily changed by e2e');

      await request(app.getHttpServer())
        .patch('/api/v1/person')
        .set(auth())
        .send({ tagline: before })
        .expect(200);
    });

    it('reads the contact with its social links', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/contact').set(auth()).expect(200);
      expect(Array.isArray(res.body.socialLinks)).toBe(true);
    });
  });
});
