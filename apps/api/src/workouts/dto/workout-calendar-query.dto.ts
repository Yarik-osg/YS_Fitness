import {
  workoutCalendarQuerySchema,
  type WorkoutCalendarQuery,
} from '@repo/validation';

export class WorkoutCalendarQueryDto implements WorkoutCalendarQuery {
  static readonly schema = workoutCalendarQuerySchema;

  from!: string;
  to!: string;
}
