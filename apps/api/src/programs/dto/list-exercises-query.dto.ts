import {
  listExercisesQuerySchema,
  type ListExercisesQuery,
} from '@repo/validation';

export class ListExercisesQueryDto implements ListExercisesQuery {
  static readonly schema = listExercisesQuerySchema;

  muscleGroup?: ListExercisesQuery['muscleGroup'];
}
