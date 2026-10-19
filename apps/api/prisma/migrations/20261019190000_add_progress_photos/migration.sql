-- CreateTable
CREATE TABLE "public"."progress_photos" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "content_type" VARCHAR(32) NOT NULL,
    "image" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progress_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "progress_photos_user_id_created_at_idx" ON "public"."progress_photos"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "public"."progress_photos" ADD CONSTRAINT "progress_photos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
