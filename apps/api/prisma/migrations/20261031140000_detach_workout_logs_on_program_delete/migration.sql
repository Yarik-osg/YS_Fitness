-- An unassigned program can be deleted without removing workout history.
-- The log keeps the program name and code, and the program link becomes optional.
ALTER TABLE "public"."workout_logs"
ADD COLUMN "template_code" VARCHAR(16),
ADD COLUMN "template_name" VARCHAR(200);

ALTER TABLE "public"."workout_logs" ALTER COLUMN "template_id" DROP NOT NULL;

ALTER TABLE "public"."workout_logs" DROP CONSTRAINT "workout_logs_template_id_fkey";

ALTER TABLE "public"."workout_logs"
ADD CONSTRAINT "workout_logs_template_id_fkey"
FOREIGN KEY ("template_id") REFERENCES "public"."program_templates"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
