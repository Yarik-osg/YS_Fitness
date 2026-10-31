-- The program's rep range, copied onto each set when the program is deleted.
ALTER TABLE "public"."workout_log_sets"
ADD COLUMN IF NOT EXISTS "prescribed_reps_min" INTEGER;

ALTER TABLE "public"."workout_log_sets"
ADD COLUMN IF NOT EXISTS "prescribed_reps_max" INTEGER;
