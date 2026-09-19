import 'dotenv/config';
import { PrismaClient, UserRole } from '@prisma/client';
import { hash } from 'argon2';
import { readSeedEnvironment } from '../src/config/seed-environment.js';

const prisma = new PrismaClient();

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
