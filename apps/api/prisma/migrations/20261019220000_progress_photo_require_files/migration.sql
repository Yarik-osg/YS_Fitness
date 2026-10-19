-- Drop image only after the backfill has recorded a file for every row.
-- Databases that already removed image (an earlier draft of this change)
-- leave the table as it is.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'progress_photos'
      AND column_name = 'image'
  ) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM progress_photos
    WHERE storage_key IS NULL OR width IS NULL OR height IS NULL
  ) THEN
    RAISE EXCEPTION
      'progress_photos still has image bytes and no stored file. Run pnpm --filter api backfill:progress-photos, then migrate again. The image column was not dropped.';
  END IF;

  ALTER TABLE progress_photos ALTER COLUMN storage_key SET NOT NULL;
  ALTER TABLE progress_photos ALTER COLUMN width SET NOT NULL;
  ALTER TABLE progress_photos ALTER COLUMN height SET NOT NULL;
  ALTER TABLE progress_photos DROP COLUMN image;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "progress_photos_storage_key_key"
  ON "progress_photos"("storage_key");
