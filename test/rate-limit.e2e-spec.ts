import { INestApplication, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * The main e2e suite raises the throttle budgets so its own repeated logins are not
 * blocked. This file asserts the limiter actually works, by loading the application with a
 * deliberately tiny budget.
 *
 * The budgets come from test/setup-e2e-ratelimit.ts, which this file's jest config runs
 * before any import: @Throttle reads AUTH_THROTTLE_LIMIT when its class is first loaded,
 * so setting it inside beforeAll would be too late.
 */
describe('Rate limiting (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('blocks repeated failed logins once the budget is spent', async () => {
    const attempt = () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'attacker@example.com', password: 'guessing-the-password' });

    const codes: number[] = [];
    for (let i = 0; i < 6; i++) {
      codes.push((await attempt()).status);
    }

    // The first few are rejected on credentials; the rest are refused before reaching
    // password verification at all.
    expect(codes.slice(0, 3)).toEqual([401, 401, 401]);
    expect(codes.slice(3)).toEqual([429, 429, 429]);
  });

  it('does not apply the strict login budget to public reads', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 10; i++) {
      codes.push((await request(app.getHttpServer()).get('/api/v1/health')).status);
    }

    expect(codes.every((c) => c === 200)).toBe(true);
  });
});
