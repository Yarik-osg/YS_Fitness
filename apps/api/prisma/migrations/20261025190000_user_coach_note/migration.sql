ALTER TABLE "users" ADD COLUMN "coach_note" TEXT;

ALTER TABLE "users"
  ADD CONSTRAINT "users_coach_note_length"
  CHECK ("coach_note" IS NULL OR char_length("coach_note") <= 2000);
