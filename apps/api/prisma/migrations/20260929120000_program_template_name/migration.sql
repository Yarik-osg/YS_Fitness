ALTER TABLE "program_templates" ADD COLUMN "name" VARCHAR(200);

UPDATE "program_templates" SET "name" = "code" WHERE "name" IS NULL;

ALTER TABLE "program_templates" ALTER COLUMN "name" SET NOT NULL;
