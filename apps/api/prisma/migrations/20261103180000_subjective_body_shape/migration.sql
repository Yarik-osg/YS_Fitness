-- Subjective appearance. Not a body-composition measurement.
ALTER TABLE "onboarding_responses"
  ADD COLUMN "muscle_development" INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN "body_fat_level" INTEGER NOT NULL DEFAULT 50;

UPDATE "onboarding_responses"
SET "muscle_development" = ROUND(("current_body"::numeric / 9) * 100)::integer
WHERE "current_body" ~ '^[0-9]$';
