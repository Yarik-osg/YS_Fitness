import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import sharp from 'sharp';
import request from 'supertest';
import {
  configureE2eEnvironment,
  readTestDatabaseUrl,
} from '../src/config/test-environment.js';

const testDatabaseUrl = readTestDatabaseUrl() ?? '';
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase('progress photos and strength (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let imageBase64 = '';
  let photoDir = '';

  beforeAll(async () => {
    photoDir = await mkdtemp(path.join(tmpdir(), 'progress-photos-'));
    process.env.PROGRESS_PHOTO_DIR = photoDir;
    configureE2eEnvironment(testDatabaseUrl);
    imageBase64 = (
      await sharp({
        create: {
          width: 2,
          height: 2,
          channels: 3,
          background: { r: 10, g: 20, b: 30 },
        },
      })
        .jpeg()
        .toBuffer()
    ).toString('base64');

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
    await prisma.user.deleteMany({
      where: { email: { endsWith: '@progress.example.com' } },
    });
    await prisma.programTemplate.deleteMany({ where: { code: 'e2e-str' } });
    await prisma.exercise.deleteMany({
      where: { code: { startsWith: 'e2e-str-' } },
    });
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await app?.close();
    if (photoDir) await rm(photoDir, { recursive: true, force: true });
  });

  async function accessToken(email: string) {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'strong-password', clientType: 'MOBILE' })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'strong-password', clientType: 'MOBILE' })
      .expect(200);
    return login.body.tokens.accessToken as string;
  }

  function upload(token: string, body = imageBase64) {
    return request(app.getHttpServer())
      .post('/api/v1/users/me/progress-photos')
      .set('Authorization', `Bearer ${token}`)
      .send({ imageBase64: body });
  }

  it('requires a token and hides another user photos', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/users/me/progress-photos')
      .expect(401);

    const owner = await accessToken('owner@progress.example.com');
    const other = await accessToken('other@progress.example.com');
    const created = await upload(owner).expect(201);
    expect(created.body.contentType).toBe('image/jpeg');
    expect(created.body).not.toHaveProperty('imageBase64');
    expect(created.body.width).toBe(2);
    expect(created.body.height).toBe(2);

    const hidden = await request(app.getHttpServer())
      .get('/api/v1/users/me/progress-photos')
      .set('Authorization', `Bearer ${other}`)
      .expect(200);
    expect(hidden.body.photos).toEqual([]);

    const listed = await request(app.getHttpServer())
      .get('/api/v1/users/me/progress-photos')
      .set('Authorization', `Bearer ${owner}`)
      .expect(200);
    expect(listed.body.photos).toHaveLength(1);
    expect(listed.body.photos[0].id).toBe(created.body.id);

    const photoId = created.body.id as string;
    await request(app.getHttpServer())
      .get(`/api/v1/users/me/progress-photos/${photoId}`)
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/users/me/progress-photos/not-a-uuid')
      .set('Authorization', `Bearer ${owner}`)
      .expect(400);
    await request(app.getHttpServer())
      .get(`/api/v1/users/me/progress-photos/${photoId}`)
      .set('Authorization', `Bearer ${other}`)
      .expect(404);
    const image = await request(app.getHttpServer())
      .get(`/api/v1/users/me/progress-photos/${photoId}`)
      .set('Authorization', `Bearer ${owner}`)
      .expect(200);
    expect(image.headers['content-type']).toContain('image/jpeg');
    expect(image.headers['cache-control']).toBe('private, no-store');
    expect(image.body[0]).toBe(0xff);

    await request(app.getHttpServer())
      .delete(`/api/v1/users/me/progress-photos/${photoId}`)
      .expect(401);
    await request(app.getHttpServer())
      .delete(`/api/v1/users/me/progress-photos/${randomUUID()}`)
      .set('Authorization', `Bearer ${owner}`)
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/api/v1/users/me/progress-photos/${photoId}`)
      .set('Authorization', `Bearer ${other}`)
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/api/v1/users/me/progress-photos/${photoId}`)
      .set('Authorization', `Bearer ${owner}`)
      .expect(204);
    await request(app.getHttpServer())
      .delete(`/api/v1/users/me/progress-photos/${photoId}`)
      .set('Authorization', `Bearer ${owner}`)
      .expect(404);
    expect(await prisma.progressPhoto.count({ where: { id: photoId } })).toBe(
      0,
    );
  });

  it('does not store an invalid photo and keeps the cap under two overlapping uploads', async () => {
    const token = await accessToken('photos@progress.example.com');
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: 'photos@progress.example.com' },
    });
    const rejected = await upload(
      token,
      Buffer.from([0xff, 0xd8, 0xff, 0x00]).toString('base64'),
    ).expect(400);
    expect(rejected.body.code).toBe('PHOTO_INVALID');
    expect(
      await prisma.progressPhoto.count({ where: { userId: user.id } }),
    ).toBe(0);

    await prisma.progressPhoto.createMany({
      data: Array.from({ length: 7 }, () => {
        const id = randomUUID();
        return {
          id,
          userId: user.id,
          contentType: 'image/jpeg',
          storageKey: `${user.id}/${id}.jpg`,
          width: 2,
          height: 2,
        };
      }),
    });

    const raced = await Promise.all([upload(token), upload(token)]);
    expect(raced.map((result) => result.status).sort()).toEqual([201, 400]);
    expect(raced.find((result) => result.status === 400)?.body.code).toBe(
      'PHOTO_LIMIT',
    );
    expect(
      await prisma.progressPhoto.count({ where: { userId: user.id } }),
    ).toBe(8);
    expect(await readdir(path.join(photoDir, user.id))).toHaveLength(1);
  });

  it('uses the earliest loaded weight even when history is longer than 50 logs', async () => {
    const token = await accessToken('strength@progress.example.com');
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: 'strength@progress.example.com' },
    });
    const otherToken = await accessToken('intruder@progress.example.com');
    const other = await prisma.user.findUniqueOrThrow({
      where: { email: 'intruder@progress.example.com' },
    });
    const template = await prisma.programTemplate.create({
      data: {
        code: 'e2e-str',
        name: 'E2E strength',
        gender: 'FEMALE',
        level: 'BEGINNER',
        frequencyPerWeek: 1,
        accent: 'NONE',
      },
    });
    const exercise = async (code: string, name: string) =>
      prisma.exercise.create({
        data: {
          code,
          name,
          nameEn: name,
          muscleGroups: ['BACK'],
          repsMin: 8,
          repsMax: 12,
        },
      });
    const gain = await exercise('e2e-str-gain', 'Gain');
    const drop = await exercise('e2e-str-drop', 'Drop');
    const flat = await exercise('e2e-str-flat', 'Flat');
    const once = await exercise('e2e-str-once', 'Once');
    const blank = await exercise('e2e-str-blank', 'Blank');
    const tie = await exercise('e2e-str-tie', 'Tie');
    const secret = await exercise('e2e-str-secret', 'Secret');

    const started = new Date('2020-01-01T00:00:00.000Z');
    const logs = Array.from({ length: 51 }, (_, index) => ({
      id: randomUUID(),
      userId: user.id,
      templateId: template.id,
      dayNumber: 1,
      completedAt: new Date(started.getTime() + index * 86_400_000),
    }));
    const tieAt = new Date('2021-01-01T00:00:00.000Z');
    const earlierTie = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
    const laterTie = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
    await prisma.workoutLog.createMany({
      data: [
        ...logs,
        {
          id: laterTie,
          userId: user.id,
          templateId: template.id,
          dayNumber: 1,
          completedAt: tieAt,
        },
        {
          id: earlierTie,
          userId: user.id,
          templateId: template.id,
          dayNumber: 1,
          completedAt: tieAt,
        },
        {
          id: randomUUID(),
          userId: other.id,
          templateId: template.id,
          dayNumber: 1,
          completedAt: started,
        },
      ],
    });

    const set = (
      workoutLogId: string,
      exerciseId: string,
      order: number,
      setNumber: number,
      weightKg: number | null,
    ) => ({
      workoutLogId,
      exerciseId,
      order,
      setNumber,
      repsCompleted: 8,
      weightKg,
    });
    await prisma.workoutLogSet.createMany({
      data: logs.flatMap((log, index) => {
        const rows = [
          set(log.id, gain.id, 1, 1, index === 0 ? 10 : 30),
          set(log.id, gain.id, 1, 2, index === 50 ? 28 : 5),
        ];
        if (index === 0 || index === 50) {
          rows.push(
            set(log.id, drop.id, 2, 1, index === 0 ? 100 : 12),
            set(log.id, flat.id, 3, 1, 20),
          );
        }
        if (index === 50) {
          rows.push(
            set(log.id, once.id, 4, 1, 40),
            set(log.id, blank.id, 5, 1, 0),
            set(log.id, blank.id, 5, 2, null),
          );
        }
        return rows;
      }),
    });
    await prisma.workoutLogSet.createMany({
      data: [
        set(earlierTie, tie.id, 1, 1, 15),
        set(laterTie, tie.id, 1, 1, 25),
        set(logs[0]!.id, secret.id, 7, 1, 1),
      ],
    });
    const otherLog = await prisma.workoutLog.findFirstOrThrow({
      where: { userId: other.id },
    });
    await prisma.workoutLogSet.create({
      data: set(otherLog.id, secret.id, 1, 1, 90),
    });

    const listed = await request(app.getHttpServer())
      .get('/api/v1/workouts/strength')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(listed.body.changes).toEqual([
      {
        exerciseId: gain.id,
        name: 'Gain',
        nameEn: 'Gain',
        fromKg: 10,
        toKg: 30,
      },
      {
        exerciseId: tie.id,
        name: 'Tie',
        nameEn: 'Tie',
        fromKg: 15,
        toKg: 25,
      },
      {
        exerciseId: drop.id,
        name: 'Drop',
        nameEn: 'Drop',
        fromKg: 100,
        toKg: 12,
      },
    ]);

    const intruder = await request(app.getHttpServer())
      .get('/api/v1/workouts/strength')
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(200);
    expect(intruder.body.changes).toEqual([]);
  });
});
