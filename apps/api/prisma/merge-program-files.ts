import type {
  ParsedExercise,
  ParsedProgramFile,
  ParsedTemplate,
} from './parse-program-csv.js';

export interface MergedPrograms {
  exercises: ParsedExercise[];
  templates: ParsedTemplate[];
}

/** First file to define an exercise code owns its identity and catalog reps. */
export function mergeProgramFiles(files: ParsedProgramFile[]): MergedPrograms {
  const exercises = new Map<string, ParsedExercise>();
  const templates: ParsedTemplate[] = [];

  for (const file of files) {
    for (const exercise of file.exercises) {
      if (!exercises.has(exercise.code)) exercises.set(exercise.code, exercise);
    }
    templates.push(...file.templates);
  }

  return { exercises: [...exercises.values()], templates };
}
