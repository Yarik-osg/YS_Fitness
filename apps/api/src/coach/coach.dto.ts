import {
  updateCoachNoteSchema,
  type UpdateCoachNoteInput,
} from '@repo/validation';
import { z } from 'zod';

export const coachClientParamsSchema = z.object({
  userId: z.string().uuid(),
});

export const assignClientProgramSchema = z
  .object({
    templateId: z.string().uuid(),
  })
  .strict();

export class UpdateCoachNoteDto implements UpdateCoachNoteInput {
  static readonly schema = updateCoachNoteSchema;

  note!: string;
  base!: string;
}

export class AssignClientProgramDto {
  static readonly schema = assignClientProgramSchema;

  templateId!: string;
}

export const coachProgramParamsSchema = z.object({
  templateId: z.string().uuid(),
});

export class CoachProgramParamsDto {
  static readonly schema = coachProgramParamsSchema;

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

export const coachNutritionCalculationParamsSchema =
  coachClientParamsSchema.extend({
    calculationId: z.string().uuid(),
  });

export const coachTableExportSchema = z
  .object({
    filename: z
      .string()
      .regex(/^ys-fitness-(clients|nutrition)-\d{4}-\d{2}-\d{2}\.xlsx$/),
    sheet: z.enum(['Clients', 'Nutrition']),
    headers: z.array(z.string().min(1).max(80)).min(1).max(20),
    rows: z
      .array(
        z.array(z.union([z.string().max(500), z.number().finite(), z.null()])),
      )
      .max(2000),
  })
  .strict()
  .superRefine((value, context) => {
    const prefix =
      value.sheet === 'Clients'
        ? 'ys-fitness-clients-'
        : 'ys-fitness-nutrition-';
    if (!value.filename.startsWith(prefix)) {
      context.addIssue({
        code: 'custom',
        path: ['filename'],
        message: 'filename does not match the sheet',
      });
    }
    value.rows.forEach((row, index) => {
      if (row.length !== value.headers.length) {
        context.addIssue({
          code: 'custom',
          path: ['rows', index],
          message: 'row length does not match the headers',
        });
      }
    });
  });

export class CoachTableExportDto {
  static readonly schema = coachTableExportSchema;

  filename!: string;
  sheet!: 'Clients' | 'Nutrition';
  headers!: string[];
  rows!: (string | number | null)[][];
}

export class CoachNutritionCalculationParamsDto {
  static readonly schema = coachNutritionCalculationParamsSchema;

  userId!: string;
  calculationId!: string;
}
