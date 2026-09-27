-- AlterEnum
ALTER TYPE "public"."MuscleGroup" ADD VALUE 'ABS';

-- AlterTable
ALTER TABLE "public"."exercises" ADD COLUMN "reps_min" INTEGER;
ALTER TABLE "public"."exercises" ADD COLUMN "reps_max" INTEGER;

UPDATE "public"."exercises"
SET "reps_min" = 12, "reps_max" = 12
WHERE "reps_min" IS NULL OR "reps_max" IS NULL;

ALTER TABLE "public"."exercises" ALTER COLUMN "reps_min" SET NOT NULL;
ALTER TABLE "public"."exercises" ALTER COLUMN "reps_max" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."program_template_exercises" ADD COLUMN "allows_abs_addon" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "public"."program_template_exercises" DROP COLUMN "reps_min";
ALTER TABLE "public"."program_template_exercises" DROP COLUMN "reps_max";
