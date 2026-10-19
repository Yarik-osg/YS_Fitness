-- Existing rows store the image in Postgres. Development data is dropped
-- because a SQL migration cannot move those bytes onto the local disk.
DELETE FROM "progress_photos";

ALTER TABLE "progress_photos" DROP COLUMN "image";
ALTER TABLE "progress_photos" ADD COLUMN "storage_key" VARCHAR(96) NOT NULL;
ALTER TABLE "progress_photos" ADD COLUMN "width" INTEGER NOT NULL;
ALTER TABLE "progress_photos" ADD COLUMN "height" INTEGER NOT NULL;

CREATE UNIQUE INDEX "progress_photos_storage_key_key" ON "progress_photos"("storage_key");
