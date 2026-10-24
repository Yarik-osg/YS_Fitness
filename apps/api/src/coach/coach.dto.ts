import { z } from 'zod';

export const coachClientParamsSchema = z.object({
  userId: z.string().uuid(),
});

export class CoachClientParamsDto {
  static readonly schema = coachClientParamsSchema;

  userId!: string;
}

export const coachClientPhotoParamsSchema = coachClientParamsSchema.extend({
  photoId: z.string().uuid(),
});

export class CoachClientPhotoParamsDto {
  static readonly schema = coachClientPhotoParamsSchema;

  userId!: string;
  photoId!: string;
}
