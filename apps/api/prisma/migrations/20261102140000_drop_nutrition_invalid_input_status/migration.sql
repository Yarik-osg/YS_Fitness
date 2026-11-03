-- INVALID_INPUT is an API error, not a stored calculation status.
ALTER TABLE "nutrition_calculations" ALTER COLUMN "status" DROP DEFAULT;

ALTER TYPE "NutritionCalculationStatus" RENAME TO "NutritionCalculationStatus_old";

CREATE TYPE "NutritionCalculationStatus" AS ENUM ('VALID', 'REQUIRES_REVIEW');

ALTER TABLE "nutrition_calculations"
  ALTER COLUMN "status" TYPE "NutritionCalculationStatus"
  USING ("status"::text::"NutritionCalculationStatus");

DROP TYPE "NutritionCalculationStatus_old";

ALTER TABLE "nutrition_calculations"
  ALTER COLUMN "status" SET DEFAULT 'VALID';
