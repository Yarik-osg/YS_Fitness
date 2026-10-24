import { z } from 'zod';

export const coachClientParamsSchema = z.object({
  userId: z.string().uuid(),
});

export class CoachClientParamsDto {
  static readonly schema = coachClientParamsSchema;

  userId!: string;
}
