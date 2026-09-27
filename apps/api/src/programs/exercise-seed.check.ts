import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

const PLACEHOLDER_REPS = 12;

export const MISSING_EXERCISE_DATA_ERROR =
  'No exercise/program data found — run pnpm db:seed before starting the API';

export const UNSEEDED_EXERCISE_DATA_ERROR =
  'Exercise data appears to be unseeded placeholders — run pnpm db:seed before starting the API in this environment.';

@Injectable()
export class ExerciseSeedCheck implements OnApplicationBootstrap {
  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    const [exerciseCount, activeTemplates, placeholderExercisesInUse] =
      await Promise.all([
        this.prisma.exercise.count(),
        this.prisma.programTemplate.count({ where: { active: true } }),
        this.prisma.exercise.count({
          where: {
            repsMin: PLACEHOLDER_REPS,
            repsMax: PLACEHOLDER_REPS,
            templateExercises: {
              some: {
                templateDay: { template: { active: true } },
              },
            },
          },
        }),
      ]);

    if (exerciseCount === 0 || activeTemplates === 0) {
      throw new Error(MISSING_EXERCISE_DATA_ERROR);
    }
    if (placeholderExercisesInUse > 0) {
      throw new Error(UNSEEDED_EXERCISE_DATA_ERROR);
    }
  }
}
