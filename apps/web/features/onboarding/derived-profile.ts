import type { ActivityLevel, WeightGoal } from '@repo/shared-types';

const FEMALE_BODY_TO_PHYSIQUE: Record<string, string> = {
  slim: '0',
  toned: '2',
  athletic: '4',
  defined: '6',
  full: '8',
};

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
  if (FEMALE_BODY_TO_PHYSIQUE[currentBody]) {
    return FEMALE_BODY_TO_PHYSIQUE[currentBody];
  }
  if (/^[0-4]$/.test(currentBody)) {
    return String(Number(currentBody) * 2);
  }
  return undefined;
}
