import {
  listWorkoutLogsQuerySchema,
  type ListWorkoutLogsQuery,
} from '@repo/validation';

export class ListWorkoutLogsQueryDto implements ListWorkoutLogsQuery {
  static readonly schema = listWorkoutLogsQuerySchema;

  limit!: number;
  offset!: number;
}
