import {
  trainerTemplateBodySchema,
  trainerTemplateParamsSchema,
  trainerTemplateRenameSchema,
  type TrainerTemplateBody,
  type TrainerTemplateParams,
  type TrainerTemplateRename,
} from '@repo/validation';

export class TrainerTemplateBodyDto implements TrainerTemplateBody {
  static readonly schema = trainerTemplateBodySchema;

  name!: TrainerTemplateBody['name'];
  gender!: TrainerTemplateBody['gender'];
  level!: TrainerTemplateBody['level'];
  frequencyPerWeek!: TrainerTemplateBody['frequencyPerWeek'];
  accent!: TrainerTemplateBody['accent'];
  days!: TrainerTemplateBody['days'];
}

export class TrainerTemplateRenameDto implements TrainerTemplateRename {
  static readonly schema = trainerTemplateRenameSchema;

  name!: string;
}

export class TrainerTemplateParamsDto implements TrainerTemplateParams {
  static readonly schema = trainerTemplateParamsSchema;

  templateId!: string;
}
