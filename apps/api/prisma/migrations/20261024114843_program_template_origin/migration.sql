-- CreateEnum
CREATE TYPE "public"."ProgramOrigin" AS ENUM ('SYSTEM', 'TRAINER');

-- DropIndex
DROP INDEX "public"."program_templates_identity_key";

-- AlterTable
ALTER TABLE "public"."program_templates" ADD COLUMN     "origin" "public"."ProgramOrigin" NOT NULL DEFAULT 'SYSTEM',
ADD COLUMN     "owner_id" UUID;

-- AddForeignKey
ALTER TABLE "public"."program_templates" ADD CONSTRAINT "program_templates_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-added. Prisma cannot express a partial unique index or this check.
-- A later migrate must not drop them without replacing them. `prisma db push`
-- drops both. ProgramTemplateConstraintCheck refuses to boot without them.
CREATE UNIQUE INDEX "program_templates_identity_key"
ON "public"."program_templates" ("gender", "level", "frequency_per_week", "accent")
WHERE "origin" = 'SYSTEM';

ALTER TABLE "public"."program_templates"
ADD CONSTRAINT "program_templates_owner_origin_check"
CHECK (
  ("origin" = 'SYSTEM' AND "owner_id" IS NULL)
  OR ("origin" = 'TRAINER' AND "owner_id" IS NOT NULL)
);
