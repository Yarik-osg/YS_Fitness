-- Algorithm v2 keeps every existing snapshot. New columns describe the
-- version, review status, and the integers that were shown for that snapshot.
CREATE TYPE "NutritionCalculationStatus" AS ENUM ('VALID', 'REQUIRES_REVIEW', 'INVALID_INPUT');

CREATE TYPE "NutritionReviewReason" AS ENUM (
  'NEGATIVE_CARBS',
  'LOW_CALORIES',
  'EXCESSIVE_PROTEIN_RATIO',
  'EXCESSIVE_FAT_RATIO',
  'UNUSUAL_BODY_WEIGHT',
  'UNDERAGE'
);

ALTER TABLE "nutrition_calculations"
  ADD COLUMN "algorithm_version" VARCHAR(16) NOT NULL DEFAULT '1',
  ADD COLUMN "status" "NutritionCalculationStatus" NOT NULL DEFAULT 'VALID',
  ADD COLUMN "review_reasons" "NutritionReviewReason"[] NOT NULL DEFAULT ARRAY[]::"NutritionReviewReason"[],
  ADD COLUMN "display_calories" INTEGER,
  ADD COLUMN "display_protein_grams" INTEGER,
  ADD COLUMN "display_fat_grams" INTEGER,
  ADD COLUMN "display_carbs_grams" INTEGER;

UPDATE "nutrition_calculations"
SET
  "display_calories" = ROUND("target_calories")::integer,
  "display_protein_grams" = ROUND("protein_grams")::integer,
  "display_fat_grams" = ROUND("fat_grams")::integer,
  "display_carbs_grams" = ROUND("carbs_grams")::integer;

ALTER TABLE "nutrition_calculations"
  ALTER COLUMN "display_calories" SET NOT NULL,
  ALTER COLUMN "display_protein_grams" SET NOT NULL,
  ALTER COLUMN "display_fat_grams" SET NOT NULL,
  ALTER COLUMN "display_carbs_grams" SET NOT NULL;
