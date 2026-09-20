import 'dotenv/config';
import { PrismaClient, UserRole } from '@prisma/client';
import { hash } from 'argon2';
import { readSeedEnvironment } from '../src/config/seed-environment.js';

const prisma = new PrismaClient();

const CATALOG_PLANS = [
  {
    code: '3_MONTHS',
    name: '3 months',
    priceAmount: 249_000,
    intervalMonths: 3,
  },
  {
    code: '1_MONTH',
    name: '1 month',
    priceAmount: 99_000,
    intervalMonths: 1,
  },
] as const;

async function seedPlans(): Promise<void> {
  for (const plan of CATALOG_PLANS) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      create: {
        code: plan.code,
        name: plan.name,
        priceAmount: plan.priceAmount,
        currency: 'UAH',
        intervalMonths: plan.intervalMonths,
        isActive: true,
      },
      update: {
        name: plan.name,
        priceAmount: plan.priceAmount,
        currency: 'UAH',
        intervalMonths: plan.intervalMonths,
        isActive: true,
      },
    });
  }
}

async function main(): Promise<void> {
  const { SEED_TRAINER_EMAIL: email, SEED_TRAINER_PASSWORD: password } =
    readSeedEnvironment();

  const passwordHash = await hash(password);

  await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      role: UserRole.TRAINER,
    },
    update: {
      passwordHash,
      role: UserRole.TRAINER,
      isActive: true,
    },
  });

  await seedPlans();

  console.log(`Trainer account is ready: ${email}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
