-- AlterTable
ALTER TABLE "food_products" ADD COLUMN "barcode" VARCHAR(13);

-- One barcode per user among custom foods. Products without a barcode stay unlimited.
-- Prisma cannot model the WHERE clause. Do not let a later migration drop this index.
CREATE UNIQUE INDEX "food_products_custom_barcode_key"
ON "food_products" ("owner_id", "barcode")
WHERE "source" = 'CUSTOM' AND "barcode" IS NOT NULL;
