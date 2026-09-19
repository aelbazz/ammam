import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import * as argon2 from 'argon2';
import { ContactSubmissionStatus, Role } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * End-to-end coverage for the Portfolio marketing site's "contact us" form: the public
 * write path, RBAC on the admin-facing read/update path, spam handling, and that the audit
 * trail records both outcomes distinctly - see src/contact-submission/.
 */
describe('Contact submissions (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let clientToken: string;

  const ADMIN_EMAIL = 'contact-e2e-admin@test.local';
  const ADMIN_PASSWORD = 'ContactE2eAdminPassword123';
  const CLIENT_EMAIL = 'contact-e2e-client@test.local';
  const CLIENT_PASSWORD = 'ContactE2eClientPassword123';
  const FIXTURE_SLUG = 'contact-e2e-fixture';

  async function login(email: string, password: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
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

    await prisma.user.deleteMany({ where: { email: { in: [ADMIN_EMAIL, CLIENT_EMAIL] } } });
    await prisma.tenant.deleteMany({ where: { slug: FIXTURE_SLUG } });
    await prisma.contactSubmission.deleteMany({
      where: { email: { contains: '@contact-e2e.test' } },
    });

    await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        passwordHash: await argon2.hash(ADMIN_PASSWORD, { type: argon2.argon2id }),
        role: Role.ADMIN,
        tenantId: null,
      },
    });

    const tenant = await prisma.tenant.create({
      data: { slug: FIXTURE_SLUG, name: 'Contact E2E Fixture', status: 'ACTIVE' },
    });
    await prisma.person.create({
      data: {
        tenantId: tenant.id,
        name: 'Contact E2E Fixture',
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
        role: Role.CLIENT,
        tenantId: tenant.id,
      },
    });

    adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    clientToken = await login(CLIENT_EMAIL, CLIENT_PASSWORD);
  });

  afterAll(async () => {
    await prisma.contactSubmission.deleteMany({
      where: { email: { contains: '@contact-e2e.test' } },
    });
    await prisma.user.deleteMany({ where: { email: { in: [ADMIN_EMAIL, CLIENT_EMAIL] } } });
    await prisma.tenant.deleteMany({ where: { slug: FIXTURE_SLUG } });
    await app.close();
  });

  const admin = () => ({ Authorization: `Bearer ${adminToken}` });
  const client = () => ({ Authorization: `Bearer ${clientToken}` });

  it('accepts a public submission with no authentication and persists it as NEW', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/contact-submissions')
      .send({
        name: 'Jane Doe',
        email: 'jane@contact-e2e.test',
        subject: 'Interested in Portfolio',
        message: 'Hello there',
      })
      .expect(201);

    expect(res.body.status).toBe(ContactSubmissionStatus.NEW);

    const row = await prisma.contactSubmission.findUnique({ where: { id: res.body.id } });
    expect(row?.status).toBe(ContactSubmissionStatus.NEW);
  });

  it('strips HTML from the submitted fields', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/contact-submissions')
      .send({
        name: '<script>alert(1)</script>Jane',
        email: 'jane2@contact-e2e.test',
        subject: 'Hi',
        message: 'Hello <b>World</b>',
      })
      .expect(201);

    expect(res.body.name).toBe('Jane');
    expect(res.body.message).toBe('Hello World');
  });

  it('logs the submission in the audit trail with no actor', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/contact-submissions')
      .send({
        name: 'Audit Check',
        email: 'audit@contact-e2e.test',
        subject: 'Hi',
        message: 'Hello',
      })
      .expect(201);

    const entry = await prisma.auditLog.findFirst({
      where: { resource: 'contact_submission', resourceId: res.body.id },
    });
    expect(entry?.action).toBe('CONTACT_SUBMISSION_CREATED');
    expect(entry?.actorId).toBeNull();
  });

  it('shadow-bans a honeypot-filled submission: still 201, but stored as SPAM', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/contact-submissions')
      .send({
        name: 'Bot',
        email: 'bot@contact-e2e.test',
        subject: 'Buy now',
        message: 'spam',
        honeypot: 'filled',
      })
      .expect(201);

    const row = await prisma.contactSubmission.findUnique({ where: { id: res.body.id } });
    expect(row?.status).toBe(ContactSubmissionStatus.SPAM);
  });

  it('rejects a malformed submission with 400', () =>
    request(app.getHttpServer())
      .post('/api/v1/contact-submissions')
      .send({ name: 'No email or subject' })
      .expect(400));

  it('requires authentication to list submissions', () =>
    request(app.getHttpServer()).get('/api/v1/contact-submissions').expect(401));

  it('forbids a CLIENT from listing submissions - this is a platform, not tenant, resource', () =>
    request(app.getHttpServer()).get('/api/v1/contact-submissions').set(client()).expect(403));

  it('allows an ADMIN to list submissions', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/contact-submissions')
      .set(admin())
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('lets an ADMIN change a submission status, recording who and when', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/contact-submissions')
      .send({
        name: 'Status Check',
        email: 'status@contact-e2e.test',
        subject: 'Hi',
        message: 'Hello',
      })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/contact-submissions/${created.body.id}`)
      .set(admin())
      .send({ status: ContactSubmissionStatus.RESOLVED })
      .expect(200);

    expect(updated.body.status).toBe(ContactSubmissionStatus.RESOLVED);

    const row = await prisma.contactSubmission.findUnique({ where: { id: created.body.id } });
    expect(row?.resolvedAt).not.toBeNull();
  });

  it('forbids a CLIENT from changing a submission status', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/contact-submissions')
      .send({
        name: 'Forbidden Check',
        email: 'forbidden@contact-e2e.test',
        subject: 'Hi',
        message: 'Hello',
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/v1/contact-submissions/${created.body.id}`)
      .set(client())
      .send({ status: ContactSubmissionStatus.RESOLVED })
      .expect(403);
  });

  it('404s when updating a submission that does not exist', () =>
    request(app.getHttpServer())
      .patch('/api/v1/contact-submissions/does-not-exist')
      .set(admin())
      .send({ status: ContactSubmissionStatus.RESOLVED })
      .expect(404));
});
