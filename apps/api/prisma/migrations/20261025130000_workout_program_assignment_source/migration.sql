-- CreateEnum
CREATE TYPE "public"."AssignmentSource" AS ENUM ('MATCHED', 'ADMIN');

-- AlterTable
ALTER TABLE "public"."workout_programs"
ADD COLUMN "assignment_source" "public"."AssignmentSource" NOT NULL DEFAULT 'MATCHED';
