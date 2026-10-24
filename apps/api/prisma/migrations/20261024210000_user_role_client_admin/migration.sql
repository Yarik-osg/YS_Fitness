-- Remove the legacy UserRole value TRAINER.
-- This migration does not promote any account. It stops if a TRAINER row remains.
-- Convert the verified owner to ADMIN before applying it.
-- An access token issued with role TRAINER is rejected until that person refreshes or signs in again.
BEGIN;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "public"."users"
    WHERE "role"::text = 'TRAINER'
  ) THEN
    RAISE EXCEPTION 'users.role still contains TRAINER; convert the owner account before dropping the enum value';
  END IF;
END $$;
CREATE TYPE "public"."UserRole_new" AS ENUM ('CLIENT', 'ADMIN');
ALTER TABLE "public"."users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "public"."users" ALTER COLUMN "role" TYPE "public"."UserRole_new" USING ("role"::text::"public"."UserRole_new");
ALTER TYPE "public"."UserRole" RENAME TO "UserRole_old";
ALTER TYPE "public"."UserRole_new" RENAME TO "UserRole";
DROP TYPE "public"."UserRole_old";
ALTER TABLE "public"."users" ALTER COLUMN "role" SET DEFAULT 'CLIENT';
COMMIT;
