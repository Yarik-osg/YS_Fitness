import { z } from 'zod';

export const coachClientParamsSchema = z.object({
  userId: z.string().uuid(),
});

export const assignClientProgramSchema = z
  .object({
    templateId: z.string().uuid(),
  })
  .strict();

export class AssignClientProgramDto {
  static readonly schema = assignClientProgramSchema;

  templateId!: string;
}

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
