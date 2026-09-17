import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as argon2 from 'argon2';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Tenant isolation.
 *
 * Every profile is a tenant. The list endpoints being scoped is the easy half; the half
 * that actually matters is that holding a *valid* token for tenant B and supplying a real
 * id belonging to tenant A gets you nothing. These tests use real ids from the other
 * tenant, not invented ones.
 */
describe('Tenant isolation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let alphaToken: string;
  let betaToken: string;
  let alphaPersonId: string;
  let betaPersonId: string;

  const ALPHA = {
    slug: 'tenancy-alpha',
    email: 'alpha@tenancy.test',
    password: 'AlphaPassword!123',
  };
  const BETA = { slug: 'tenancy-beta', email: 'beta@tenancy.test', password: 'BetaPassword!1234' };

  // Ids belonging to ALPHA that BETA will try to reach.
  let alphaExperienceId: string;
  let alphaResponsibilityId: string;
  let alphaTechnologyId: string;
  let alphaCategoryId: string;
  let alphaSkillId: string;
  let alphaProjectId: string;

  async function createTenant(t: typeof ALPHA, name: string): Promise<string> {
    const person = await prisma.person.create({
      data: {
        slug: t.slug,
        name,
        title: 'Title',
        summary: 'Summary',
        location: 'Location',
        yearsOfExperience: 1,
        avatar: '/assets/images/profile-image.jpg',
        tagline: 'Tagline',
      },
    });

    await prisma.adminUser.create({
      data: {
        email: t.email,
        passwordHash: await argon2.hash(t.password, { type: argon2.argon2id }),
        name,
        personId: person.id,
      },
    });

    return person.id;
  }

  async function login(t: typeof ALPHA): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: t.email, password: t.password })
      .expect(200);
    return res.body.accessToken;
  }

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);

    // Clean slate in case a previous run was interrupted.
    await prisma.person.deleteMany({ where: { slug: { in: [ALPHA.slug, BETA.slug] } } });

    alphaPersonId = await createTenant(ALPHA, 'Alpha Person');
    betaPersonId = await createTenant(BETA, 'Beta Person');

    alphaToken = await login(ALPHA);
    betaToken = await login(BETA);

    // Give ALPHA some content, created through the API as ALPHA.
    const experience = await request(app.getHttpServer())
      .post('/api/v1/experiences')
      .set({ Authorization: `Bearer ${alphaToken}` })
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

    const project = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set({ Authorization: `Bearer ${alphaToken}` })
      .send({
        name: 'Alpha Project',
        description: 'desc',
        role: 'Lead',
        startDate: '2024',
        highlights: ['Alpha highlight'],
      })
      .expect(201);
    alphaProjectId = project.body.id;

    const technologies = await request(app.getHttpServer())
      .get('/api/v1/technologies')
      .set({ Authorization: `Bearer ${alphaToken}` })
      .expect(200);
    alphaTechnologyId = technologies.body[0].id;

    const category = await request(app.getHttpServer())
      .post('/api/v1/skill-categories')
      .set({ Authorization: `Bearer ${alphaToken}` })
      .send({ name: 'Alpha Skills' })
      .expect(201);
    alphaCategoryId = category.body.id;

    const skill = await request(app.getHttpServer())
      .post(`/api/v1/skill-categories/${alphaCategoryId}/skills`)
      .set({ Authorization: `Bearer ${alphaToken}` })
      .send({ name: 'Alpha Skill', level: 5 })
      .expect(201);
    alphaSkillId = skill.body.id;
  });

  afterAll(async () => {
    await prisma.person.deleteMany({ where: { slug: { in: [ALPHA.slug, BETA.slug] } } });
    await app.close();
  });

  const beta = () => ({ Authorization: `Bearer ${betaToken}` });
  const alpha = () => ({ Authorization: `Bearer ${alphaToken}` });

  // ------------------------------------------------------------------ identity

  describe('Login', () => {
    it('reports which tenant the administrator manages', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: ALPHA.email, password: ALPHA.password })
        .expect(200);

      expect(res.body.user.personId).toBe(alphaPersonId);
      expect(res.body.user.personSlug).toBe(ALPHA.slug);
    });

    it('gives each administrator a different tenant', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/auth/me').set(beta()).expect(200);

      expect(res.body.personId).toBe(betaPersonId);
      expect(res.body.personId).not.toBe(alphaPersonId);
    });
  });

  // --------------------------------------------------------------- list scoping

  describe('Lists are scoped to the caller tenant', () => {
    it('shows each tenant only its own experiences', async () => {
      const alphaList = await request(app.getHttpServer())
        .get('/api/v1/experiences')
        .set(alpha())
        .expect(200);
      const betaList = await request(app.getHttpServer())
        .get('/api/v1/experiences')
        .set(beta())
        .expect(200);

      expect(alphaList.body).toHaveLength(1);
      expect(betaList.body).toHaveLength(0);
    });

    it('does not leak the other tenant technologies', async () => {
      const betaList = await request(app.getHttpServer())
        .get('/api/v1/technologies')
        .set(beta())
        .expect(200);

      expect(betaList.body).toHaveLength(0);
      expect(JSON.stringify(betaList.body)).not.toContain('AlphaScript');
    });

    it('scopes the person singleton to the caller', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/person').set(beta()).expect(200);
      expect(res.body.name).toBe('Beta Person');
      expect(res.body.slug).toBe(BETA.slug);
    });
  });

  // ------------------------------------------------- cross-tenant id access

  describe('A valid token plus another tenant real id gets nothing', () => {
    it('cannot read the other tenant experience', () =>
      request(app.getHttpServer())
        .get(`/api/v1/experiences/${alphaExperienceId}`)
        .set(beta())
        .expect(404));

    it('cannot update the other tenant experience', () =>
      request(app.getHttpServer())
        .patch(`/api/v1/experiences/${alphaExperienceId}`)
        .set(beta())
        .send({ company: 'HIJACKED' })
        .expect(404));

    it('cannot delete the other tenant experience', () =>
      request(app.getHttpServer())
        .delete(`/api/v1/experiences/${alphaExperienceId}`)
        .set(beta())
        .expect(404));

    it('cannot reach a child row through its own id', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/experiences/responsibilities/${alphaResponsibilityId}`)
        .set(beta())
        .send({ description: 'HIJACKED' })
        .expect(404);

      await request(app.getHttpServer())
        .delete(`/api/v1/experiences/responsibilities/${alphaResponsibilityId}`)
        .set(beta())
        .expect(404);
    });

    it('cannot add a child to the other tenant experience', () =>
      request(app.getHttpServer())
        .post(`/api/v1/experiences/${alphaExperienceId}/responsibilities`)
        .set(beta())
        .send({ description: 'HIJACKED' })
        .expect(404));

    it('cannot touch the other tenant project or its highlights', () =>
      request(app.getHttpServer())
        .post(`/api/v1/projects/${alphaProjectId}/highlights`)
        .set(beta())
        .send({ description: 'HIJACKED' })
        .expect(404));

    it('cannot rename or delete the other tenant technology', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/technologies/${alphaTechnologyId}`)
        .set(beta())
        .send({ name: 'HIJACKED' })
        .expect(404);

      await request(app.getHttpServer())
        .delete(`/api/v1/technologies/${alphaTechnologyId}`)
        .set(beta())
        .expect(404);
    });

    it('cannot add a skill to the other tenant category, or delete their skill', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/skill-categories/${alphaCategoryId}/skills`)
        .set(beta())
        .send({ name: 'HIJACKED', level: 9 })
        .expect(404);

      await request(app.getHttpServer())
        .delete(`/api/v1/skill-categories/skills/${alphaSkillId}`)
        .set(beta())
        .expect(404);
    });

    it('cannot renumber the other tenant rows through reorder', async () => {
      // reorder uses updateMany scoped by personId, so a foreign id matches nothing. The
      // request succeeds as a no-op rather than revealing whether the id exists.
      await request(app.getHttpServer())
        .patch('/api/v1/experiences/reorder')
        .set(beta())
        .send({ items: [{ id: alphaExperienceId, sortOrder: 99 }] })
        .expect(204);

      const row = await prisma.experience.findUnique({ where: { id: alphaExperienceId } });
      expect(row?.sortOrder).not.toBe(99);
    });

    it('leaves every one of the other tenant records untouched', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/experiences/${alphaExperienceId}`)
        .set(alpha())
        .expect(200);

      expect(res.body.company).toBe('Alpha Corp');
      expect(res.body.responsibilities).toHaveLength(1);
      expect(res.body.responsibilities[0].description).toBe('Alpha duty');
      expect(res.body.technologies).toEqual(['AlphaScript']);
    });
  });

  // --------------------------------------------------------------- public reads

  describe('Public profiles are addressed per tenant', () => {
    it('serves each tenant at its own slug, anonymously', async () => {
      const alphaProfile = await request(app.getHttpServer())
        .get(`/api/v1/public/profile/${ALPHA.slug}`)
        .expect(200);
      const betaProfile = await request(app.getHttpServer())
        .get(`/api/v1/public/profile/${BETA.slug}`)
        .expect(200);

      expect(alphaProfile.body.person.name).toBe('Alpha Person');
      expect(betaProfile.body.person.name).toBe('Beta Person');
      expect(alphaProfile.body.experiences).toHaveLength(1);
      expect(betaProfile.body.experiences).toHaveLength(0);
    });

    it('does not put one tenant content in another tenant payload', async () => {
      const betaProfile = await request(app.getHttpServer())
        .get(`/api/v1/public/profile/${BETA.slug}`)
        .expect(200);

      expect(betaProfile.text).not.toContain('Alpha Corp');
      expect(betaProfile.text).not.toContain('AlphaScript');
      expect(betaProfile.text).not.toContain('Alpha duty');
    });

    it('404s for a slug that does not exist', () =>
      request(app.getHttpServer()).get('/api/v1/public/profile/no-such-tenant').expect(404));

    it('still exposes no administrative metadata', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/public/profile/${ALPHA.slug}`)
        .expect(200);

      expect(res.text).not.toContain('passwordHash');
      expect(res.text).not.toContain('personId');
      expect(res.text).not.toContain('isPublished');
    });
  });

  // ------------------------------------------------------- per-tenant uniqueness

  describe('Per-tenant key spaces', () => {
    it('lets both tenants own a technology with the same name', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/technologies')
        .set(beta())
        .send({ name: 'AlphaScript' })
        .expect(201);

      const rows = await prisma.technology.findMany({ where: { slug: 'alphascript' } });
      const owners = rows.map((r) => r.personId).sort();

      expect(rows).toHaveLength(2);
      expect(owners).toEqual([alphaPersonId, betaPersonId].sort());
    });

    it('lets both tenants start their legacy ids at 1', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/experiences')
        .set(beta())
        .send({
          company: 'Beta Corp',
          position: 'Engineer',
          location: 'Remote',
          startDate: 'Jan 2024',
          isCurrent: true,
          description: 'Beta work',
        })
        .expect(201);

      // Alpha already has exp1; Beta's sequence is its own, so this is exp1 too.
      expect(created.body.legacyId).toBe('exp1');

      const alphaFirst = await prisma.experience.findFirst({
        where: { personId: alphaPersonId, legacyId: 'exp1' },
      });
      expect(alphaFirst).not.toBeNull();
      expect(alphaFirst?.id).not.toBe(created.body.id);
    });
  });
});
