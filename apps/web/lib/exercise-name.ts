export interface ExerciseNames {
  name: string;
  nameEn: string;
}

/**
 * Ukrainian is the trainer's source name; English falls back to it until an
 * English name exists, so a missing translation never renders blank.
 */
export function exerciseName(exercise: ExerciseNames, locale: string): string {
  if (locale === 'en' && exercise.nameEn.trim() !== '') return exercise.nameEn;
  return exercise.name;
}
