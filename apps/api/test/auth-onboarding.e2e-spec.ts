import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { hash } from 'argon2';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import {
  configureE2eEnvironment,
  readTestDatabaseUrl,
} from '../src/config/test-environment.js';
import {
  FEMALE_ONBOARDING,
  FEMALE_ONBOARDING_ANSWERS,
} from './onboarding.fixture.js';

const testDatabaseUrl = readTestDatabaseUrl() ?? '';
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase('auth and onboarding (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  beforeAll(async () => {
    configureE2eEnvironment(testDatabaseUrl);

    const [{ Test }, { AppModule }] = await Promise.all([
      import('@nestjs/testing'),
      import('../src/app.module.js'),
    ]);
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    await app.init();
    prisma = new PrismaClient({
      datasources: { db: { url: testDatabaseUrl } },
    });
  });

  beforeEach(async () => {
    await prisma.subscription.deleteMany();
    await prisma.authRefreshToken.deleteMany();
    await prisma.authSession.deleteMany();
    await prisma.bodyMeasurement.deleteMany();
    await prisma.onboardingResponses.deleteMany();
    await prisma.userProfile.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await app?.close();
  });

  it('registers, logs in, rotates once, and revokes on replay', async () => {
    const registration = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'CLIENT@EXAMPLE.COM',
        password: 'strong-password',
        clientType: 'MOBILE',
      })
      .expect(201);

    expect(registration.body.user.email).toBe('client@example.com');
    expect(registration.body.user.name).toBeNull();
    expect(registration.body.tokens.refreshToken).toBeTypeOf('string');

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'client@example.com',
        password: 'strong-password',
        clientType: 'MOBILE',
      })
      .expect(409);

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'client@example.com',
        password: 'strong-password',
        clientType: 'MOBILE',
      })
      .expect(200);

    const firstRefreshToken = login.body.tokens.refreshToken as string;
    const rotation = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({
        refreshToken: firstRefreshToken,
        clientType: 'MOBILE',
      })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({
        refreshToken: firstRefreshToken,
        clientType: 'MOBILE',
      })
      .expect(401);

    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${rotation.body.tokens.accessToken}`)
      .expect(401);
  });

  it('protects browser refresh with origin and double-submit CSRF', async () => {
    const registration = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Origin', 'http://localhost:3000')
      .send({
        email: 'web@example.com',
        password: 'strong-password',
        clientType: 'WEB',
      })
      .expect(201);

    const cookies = registration.headers['set-cookie'] as unknown as string[];
    const refreshCookie = cookies.find((cookie) =>
      cookie.startsWith('ys_refresh='),
    );
    const csrfCookie = cookies.find((cookie) =>
      cookie.startsWith('ys_refresh_csrf='),
    );
    const csrfToken = csrfCookie?.split(';')[0]?.split('=')[1];

    expect(refreshCookie).toBeDefined();
    expect(csrfToken).toBeDefined();
    expect(registration.body.tokens.refreshToken).toBeUndefined();

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', [refreshCookie!, csrfCookie!])
      .send({ clientType: 'WEB' })
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Origin', 'http://localhost:3000')
      .set('x-csrf-token', csrfToken!)
      .set('Cookie', [refreshCookie!, csrfCookie!])
      .send({ clientType: 'WEB' })
      .expect(200);
  });

  it('upserts onboarding and does not duplicate an unchanged weight', async () => {
    const registration = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'onboarding@example.com',
        password: 'strong-password',
        clientType: 'MOBILE',
      })
      .expect(201);

    const authorization = `Bearer ${registration.body.tokens.accessToken}`;

    await request(app.getHttpServer())
      .get('/api/v1/users/me/onboarding-responses')
      .set('Authorization', authorization)
      .expect(200, { responses: null });

    await request(app.getHttpServer())
      .put('/api/v1/users/me/onboarding')
      .set('Authorization', authorization)
      .send(FEMALE_ONBOARDING)
      .expect(200);

    const saved = await request(app.getHttpServer())
      .get('/api/v1/users/me/onboarding-responses')
      .set('Authorization', authorization)
      .expect(200);

    expect(saved.body.responses).toMatchObject(FEMALE_ONBOARDING_ANSWERS);

    const me = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', authorization)
      .expect(200);
    expect(me.body.profile.name).toBe('Olena');

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'onboarding@example.com',
        password: 'strong-password',
        clientType: 'MOBILE',
      })
      .expect(200);
    expect(login.body.user.name).toBe('Olena');

    await request(app.getHttpServer())
      .put('/api/v1/users/me/onboarding')
      .set('Authorization', authorization)
      .send(FEMALE_ONBOARDING)
      .expect(200);

    expect(await prisma.userProfile.count()).toBe(1);
    expect(await prisma.bodyMeasurement.count()).toBe(1);
    expect(await prisma.onboardingResponses.count()).toBe(1);
  });

  describe('browser refresh reuse grace', () => {
    const origin = 'http://localhost:3000';

    function browserCookies(response: request.Response) {
      const cookies = (response.headers['set-cookie'] ??
        []) as unknown as string[];
      const refresh = cookies
        .find((cookie) => cookie.startsWith('ys_refresh='))
        ?.split(';')[0];
      const csrf = cookies
        .find((cookie) => cookie.startsWith('ys_refresh_csrf='))
        ?.split(';')[0];
      return { refresh, csrf, csrfToken: csrf?.split('=')[1] };
    }

    async function webLogin(email: string) {
      await prisma.user.create({
        data: { email, passwordHash: await hash('strong-password') },
      });
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('Origin', origin)
        .send({ email, password: 'strong-password', clientType: 'WEB' })
        .expect(200);
      const cookies = browserCookies(login);
      expect(cookies.refresh).toBeDefined();
      expect(cookies.csrf).toBeDefined();
      return cookies as { refresh: string; csrf: string; csrfToken: string };
    }

    function refreshWith(
      refreshCookie: string,
      csrf: { csrf: string; csrfToken: string },
    ) {
      return request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Origin', origin)
        .set('x-csrf-token', csrf.csrfToken)
        .set('Cookie', [refreshCookie, csrf.csrf])
        .send({ clientType: 'WEB' });
    }

    async function sessionRevoked() {
      const session = await prisma.authSession.findFirstOrThrow();
      return session.revokedAt !== null;
    }

    it('keeps the session when two tabs refresh with the same cookie at once', async () => {
      const login = await webLogin('two-tabs@example.com');

      const [first, second] = await Promise.all([
        refreshWith(login.refresh, login),
        refreshWith(login.refresh, login),
      ]);

      expect([first.status, second.status]).toEqual([200, 200]);
      const rotated = [first, second]
        .map((response) => browserCookies(response).refresh)
        .filter(Boolean);
      expect(rotated).toHaveLength(1);
      expect(await sessionRevoked()).toBe(false);

      for (const response of [first, second]) {
        await request(app.getHttpServer())
          .get('/api/v1/users/me')
          .set('Authorization', `Bearer ${response.body.tokens.accessToken}`)
          .expect(200);
      }

      await refreshWith(rotated[0]!, login).expect(200);
    });

    it('still revokes when a token two generations old is replayed', async () => {
      const login = await webLogin('two-generations@example.com');
      const firstRotation = await refreshWith(login.refresh, login).expect(200);
      const secondRefresh = browserCookies(firstRotation).refresh!;
      await refreshWith(secondRefresh, login).expect(200);

      const replay = await refreshWith(login.refresh, login).expect(401);

      expect(replay.body.code).toBe('REFRESH_TOKEN_REUSED');
      expect(await sessionRevoked()).toBe(true);
    });

    it('still revokes when the previous token is replayed after the grace window', async () => {
      const login = await webLogin('late-replay@example.com');
      await refreshWith(login.refresh, login).expect(200);
      await prisma.authRefreshToken.updateMany({
        where: { consumedAt: { not: null } },
        data: { consumedAt: new Date(Date.now() - 60_000) },
      });

      const replay = await refreshWith(login.refresh, login).expect(401);

      expect(replay.body.code).toBe('REFRESH_TOKEN_REUSED');
      expect(await sessionRevoked()).toBe(true);
    });
  });
});
