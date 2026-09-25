import type { ActivityLevel, WeightGoal } from '@repo/shared-types';

export function weightGoalFromMainGoal(
  mainGoal?: string,
): WeightGoal | undefined {
  switch (mainGoal) {
    case 'lose_weight':
      return 'LOSE_WEIGHT';
    case 'maintain':
    case 'improve_body':
      return 'MAINTAIN_WEIGHT';
    case 'build_muscle':
    case 'get_stronger':
      return 'GAIN_WEIGHT';
    default:
      return undefined;
  }
}

export function activityLevelFromFrequency(
  trainingFrequency?: string,
): ActivityLevel | undefined {
  switch (trainingFrequency) {
    case '2':
      return 'LIGHTLY_ACTIVE';
    case '3':
      return 'MODERATELY_ACTIVE';
    case '4':
      return 'VERY_ACTIVE';
    default:
      return undefined;
  }
}

export function physiqueLevelFromCurrentBody(
  currentBody?: string,
): string | undefined {
  if (!currentBody) return undefined;
  if (/^[0-9]$/.test(currentBody)) {
    return currentBody;
  }
  return undefined;
}
