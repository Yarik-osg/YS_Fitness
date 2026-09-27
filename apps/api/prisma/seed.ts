import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient, UserRole } from '@prisma/client';
import { hash } from 'argon2';
import { readSeedEnvironment } from '../src/config/seed-environment.js';
import { CATALOG_PLANS } from './catalog-plans.js';
import {
  parseProgramCsv,
  type ParsedExercise,
  type ParsedTemplate,
} from './parse-program-csv.js';

const prisma = new PrismaClient();

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
  await seedPrograms();

  console.log(`Trainer account is ready: ${email}`);
}

async function seedPrograms(): Promise<void> {
  const directory = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'seed-data',
  );
  const files = (await readdir(directory))
    .filter((name) => name.endsWith('.csv'))
    .sort();
  const exercises = new Map<string, ParsedExercise>();
  const templates: ParsedTemplate[] = [];

  for (const file of files) {
    const parsed = parseProgramCsv(
      await readFile(path.join(directory, file), 'utf8'),
    );
    for (const exercise of parsed.exercises) {
      const existing = exercises.get(exercise.code);
      if (
        existing &&
        (existing.name !== exercise.name ||
          existing.muscleGroups.join() !== exercise.muscleGroups.join() ||
          existing.repsMin !== exercise.repsMin ||
          existing.repsMax !== exercise.repsMax)
      ) {
        throw new Error(
          `${file} disagrees with an earlier library row for ${exercise.code}`,
        );
      }
      exercises.set(exercise.code, exercise);
    }
    templates.push(...parsed.templates);
  }

  await prisma.$transaction(async (transaction) => {
    const exerciseIds = new Map<string, string>();
    for (const exercise of exercises.values()) {
      const saved = await transaction.exercise.upsert({
        where: { code: exercise.code },
        create: exercise,
        update: {
          name: exercise.name,
          muscleGroups: exercise.muscleGroups,
          repsMin: exercise.repsMin,
          repsMax: exercise.repsMax,
        },
      });
      exerciseIds.set(exercise.code, saved.id);
    }

    for (const template of templates) {
      const saved = await transaction.programTemplate.upsert({
        where: { code: template.code },
        create: {
          code: template.code,
          gender: template.gender,
          level: template.level,
          frequencyPerWeek: template.frequencyPerWeek,
          accent: template.accent,
          active: true,
        },
        update: {
          gender: template.gender,
          level: template.level,
          frequencyPerWeek: template.frequencyPerWeek,
          accent: template.accent,
          active: true,
        },
      });
      await transaction.programTemplateDay.deleteMany({
        where: { templateId: saved.id },
      });
      for (const day of template.days) {
        await transaction.programTemplateDay.create({
          data: {
            templateId: saved.id,
            dayNumber: day.dayNumber,
            exercises: {
              create: day.exercises.map((exercise) => ({
                exerciseId: requiredExerciseId(
                  exerciseIds,
                  exercise.exerciseCode,
                ),
                order: exercise.order,
                sets: exercise.sets,
                allowsAbsAddon: exercise.allowsAbsAddon,
              })),
            },
          },
        });
      }
    }

    await transaction.programTemplate.updateMany({
      where:
        templates.length === 0
          ? undefined
          : { code: { notIn: templates.map((template) => template.code) } },
      data: { active: false },
    });
  });
}

function requiredExerciseId(ids: Map<string, string>, code: string): string {
  const id = ids.get(code);
  if (!id) throw new Error(`Missing exercise ${code}`);
  return id;
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
