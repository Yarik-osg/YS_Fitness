import {
  acceptPromotionSchema,
  type AcceptPromotionInput,
} from '@repo/validation';

export class AcceptPromotionDto implements AcceptPromotionInput {
  static readonly schema = acceptPromotionSchema;

  templateId!: string;
}
