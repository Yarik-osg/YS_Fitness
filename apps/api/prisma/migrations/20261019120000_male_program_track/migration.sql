-- AlterEnum
ALTER TYPE "public"."MuscleGroup" ADD VALUE 'REAR_DELTOIDS';
ALTER TYPE "public"."MuscleGroup" ADD VALUE 'CALVES';

-- AlterEnum
ALTER TYPE "public"."ProgramAccent" ADD VALUE 'BACK';
ALTER TYPE "public"."ProgramAccent" ADD VALUE 'CHEST';
ALTER TYPE "public"."ProgramAccent" ADD VALUE 'SHOULDERS';
ALTER TYPE "public"."ProgramAccent" ADD VALUE 'ARMS';
ALTER TYPE "public"."ProgramAccent" ADD VALUE 'LEGS';

-- AlterTable
ALTER TABLE "public"."program_template_exercises" ADD COLUMN "reps_min" INTEGER;
ALTER TABLE "public"."program_template_exercises" ADD COLUMN "reps_max" INTEGER;

UPDATE "public"."program_template_exercises" AS row
SET
  "reps_min" = exercise."reps_min",
  "reps_max" = exercise."reps_max"
FROM "public"."exercises" AS exercise
WHERE row."exercise_id" = exercise."id"
  AND (row."reps_min" IS NULL OR row."reps_max" IS NULL);

ALTER TABLE "public"."program_template_exercises" ALTER COLUMN "reps_min" SET NOT NULL;
ALTER TABLE "public"."program_template_exercises" ALTER COLUMN "reps_max" SET NOT NULL;
