-- Keep image bytes until every row has a verified file.
-- Apply this migration, run `pnpm --filter api backfill:progress-photos`,
-- then apply 20261019220000_progress_photo_require_files.
ALTER TABLE "progress_photos" ADD COLUMN "storage_key" VARCHAR(96);
ALTER TABLE "progress_photos" ADD COLUMN "width" INTEGER;
ALTER TABLE "progress_photos" ADD COLUMN "height" INTEGER;
