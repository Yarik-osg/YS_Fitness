import { describe, expect, it, vi } from 'vitest';
import {
  ExerciseSeedCheck,
  MISSING_EXERCISE_DATA_ERROR,
  UNSEEDED_EXERCISE_DATA_ERROR,
} from './exercise-seed.check.js';

type ExerciseCountArgs = {
  where?: {
    repsMin?: number;
    repsMax?: number;
    templateExercises?: {
      some?: {
        templateDay?: {
          template?: { active?: boolean };
        };
      };
    };
  };
};

function referencesActiveTemplate(args?: ExerciseCountArgs): boolean {
  return (
    args?.where?.repsMin === 12 &&
    args?.where?.repsMax === 12 &&
    args.where.templateExercises?.some?.templateDay?.template?.active === true
  );
}

function checkWith(state: {
  exercises: number;
  activeTemplates: number;
  placeholdersOnActiveTemplates: number;
  unscopedPlaceholders?: number;
  templates?: number;
}) {
  const prisma = {
    exercise: {
      count: vi.fn((args?: ExerciseCountArgs) => {
        if (referencesActiveTemplate(args)) {
          return Promise.resolve(state.placeholdersOnActiveTemplates);
        }
        if (args?.where?.repsMin === 12) {
          return Promise.resolve(state.unscopedPlaceholders ?? state.exercises);
        }
        return Promise.resolve(state.exercises);
      }),
    },
    programTemplate: {
      count: vi.fn((args?: { where?: { active?: boolean } }) =>
        Promise.resolve(
          args?.where?.active === true
            ? state.activeTemplates
            : (state.templates ?? state.activeTemplates),
        ),
      ),
    },
  };
  return new ExerciseSeedCheck(prisma as never);
}

const seeded = {
  exercises: 44,
  activeTemplates: 27,
  placeholdersOnActiveTemplates: 0,
  unscopedPlaceholders: 10,
  templates: 30,
};

describe('ExerciseSeedCheck', () => {
  it('refuses to boot when the catalog has no exercises and no templates', async () => {
    await expect(
      checkWith({
        exercises: 0,
        activeTemplates: 0,
        placeholdersOnActiveTemplates: 0,
        templates: 0,
      }).onApplicationBootstrap(),
    ).rejects.toThrow(MISSING_EXERCISE_DATA_ERROR);
  });

  it('refuses to boot when exercises exist but every template is inactive', async () => {
    await expect(
      checkWith({
        exercises: 44,
        activeTemplates: 0,
        placeholdersOnActiveTemplates: 44,
        unscopedPlaceholders: 44,
        templates: 27,
      }).onApplicationBootstrap(),
    ).rejects.toThrow(MISSING_EXERCISE_DATA_ERROR);
  });

  it('refuses to boot when active templates exist but no exercises do', async () => {
    await expect(
      checkWith({
        exercises: 0,
        activeTemplates: 27,
        placeholdersOnActiveTemplates: 0,
      }).onApplicationBootstrap(),
    ).rejects.toThrow(MISSING_EXERCISE_DATA_ERROR);
  });

  it('refuses to boot when an active template still uses a 12/12 exercise', async () => {
    await expect(
      checkWith({
        exercises: 44,
        activeTemplates: 27,
        placeholdersOnActiveTemplates: 44,
      }).onApplicationBootstrap(),
    ).rejects.toThrow(UNSEEDED_EXERCISE_DATA_ERROR);
  });

  it('boots when active templates reference exercises with real rep ranges', async () => {
    await expect(
      checkWith(seeded).onApplicationBootstrap(),
    ).resolves.toBeUndefined();
  });

  it('boots when no exercise on an active template allows an abs add-on', async () => {
    await expect(
      checkWith(seeded).onApplicationBootstrap(),
    ).resolves.toBeUndefined();
  });

  it('boots when only an inactive template still has placeholder reps', async () => {
    await expect(
      checkWith({
        ...seeded,
        unscopedPlaceholders: 8,
        placeholdersOnActiveTemplates: 0,
      }).onApplicationBootstrap(),
    ).resolves.toBeUndefined();
  });
});
