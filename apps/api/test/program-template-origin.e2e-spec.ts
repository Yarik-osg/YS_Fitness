import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { PrismaClient, type ProgramTemplate } from '@prisma/client';

const { databaseName, devDatabaseUrl } = createRequire(import.meta.url)(
  '../../../scripts/e2e-database.mjs',
) as {
  databaseName: (value: string) => string;
  devDatabaseUrl: () => string;
};
import {
  configureE2eEnvironment,
  readTestDatabaseUrl,
} from '../src/config/test-environment.js';

const testDatabaseUrl = readTestDatabaseUrl();
const testDatabaseName = testDatabaseUrl ? databaseName(testDatabaseUrl) : '';
const devName = databaseName(devDatabaseUrl());

if (
  testDatabaseUrl &&
  (testDatabaseName !== 'ys_fitness_test' || testDatabaseName === devName)
) {
  throw new Error(
    'Refusing to run: TEST_DATABASE_URL must be the ys_fitness_test database and must not be the dev database.',
  );
}

const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase('program template origin (e2e)', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    configureE2eEnvironment(testDatabaseUrl!);
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('keeps system identity unique and allows a trainer template to reuse it', async () => {
    const indexes = await prisma.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes
      WHERE tablename = 'program_templates'
        AND indexname = 'program_templates_identity_key'
    `;
    const checks = await prisma.$queryRaw<{ definition: string }[]>`
      SELECT pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conname = 'program_templates_owner_origin_check'
        AND contype = 'c'
    `;
    expect(indexes[0]?.indexdef).toContain('UNIQUE');
    expect(indexes[0]?.indexdef).toContain('SYSTEM');
    expect(checks[0]?.definition).toContain('TRAINER');
    expect(checks[0]?.definition).toContain('owner_id');

    const drifted = await prisma.programTemplate.count({
      where: {
        OR: [
          { origin: { not: 'SYSTEM' } },
          { origin: 'SYSTEM', ownerId: { not: null } },
        ],
      },
    });
    expect(drifted).toBe(0);

    const system = await prisma.programTemplate.findFirst({
      where: { origin: 'SYSTEM', active: true },
    });
    expect(system).not.toBeNull();

    await expect(
      prisma.programTemplate.create({
        data: identityCopy(system!, `Z${randomBytes(7).toString('hex')}`),
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    const owner = await prisma.user.create({
      data: {
        email: `origin-lock-${randomBytes(4).toString('hex')}@example.com`,
        passwordHash: 'not-a-login',
        role: 'TRAINER',
      },
    });
    let trainerId: string | undefined;
    try {
      const trainer = await prisma.programTemplate.create({
        data: {
          ...identityCopy(system!, `T${randomBytes(7).toString('hex')}`),
          origin: 'TRAINER',
          ownerId: owner.id,
        },
      });
      trainerId = trainer.id;

      expect(trainer.origin).toBe('TRAINER');
      expect(trainer.ownerId).toBe(owner.id);
    } finally {
      if (trainerId) {
        await prisma.programTemplate.delete({ where: { id: trainerId } });
      }
      await prisma.user.delete({ where: { id: owner.id } });
    }
  });
});

function identityCopy(system: ProgramTemplate, code: string) {
  return {
    code,
    name: code,
    gender: system.gender,
    level: system.level,
    frequencyPerWeek: system.frequencyPerWeek,
    accent: system.accent,
    origin: 'SYSTEM' as const,
  };
}
