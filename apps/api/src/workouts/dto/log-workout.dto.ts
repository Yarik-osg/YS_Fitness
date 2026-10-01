import { logWorkoutSchema, type LogWorkoutInput } from '@repo/validation';

export class LogWorkoutDto implements LogWorkoutInput {
  static readonly schema = logWorkoutSchema;

  templateId!: string;
  dayNumber!: number;
  sets!: LogWorkoutInput['sets'];
}
