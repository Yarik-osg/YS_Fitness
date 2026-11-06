-- CreateEnum
CREATE TYPE "public"."FoodProductSource" AS ENUM ('OFF', 'CUSTOM');

-- CreateEnum
CREATE TYPE "public"."FoodMeal" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK');

-- CreateTable
CREATE TABLE "public"."food_products" (
    "id" UUID NOT NULL,
    "source" "public"."FoodProductSource" NOT NULL,
    "external_id" VARCHAR(32),
    "owner_id" UUID,
    "based_on_product_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "brand" VARCHAR(200),
    "image_url" VARCHAR(2000),
    "kcal_per_100g" DECIMAL(7,2) NOT NULL,
    "protein_per_100g" DECIMAL(7,2) NOT NULL,
    "fat_per_100g" DECIMAL(7,2) NOT NULL,
    "carbs_per_100g" DECIMAL(7,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "food_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."favorite_foods" (
    "user_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorite_foods_pkey" PRIMARY KEY ("user_id","product_id")
);

-- CreateTable
CREATE TABLE "public"."food_log_entries" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "product_id" UUID,
    "logged_on" DATE NOT NULL,
    "meal" "public"."FoodMeal" NOT NULL,
    "grams" DECIMAL(7,1) NOT NULL,
    "product_name" VARCHAR(200) NOT NULL,
    "image_url" VARCHAR(2000),
    "kcal" DECIMAL(7,1) NOT NULL,
    "protein" DECIMAL(7,1) NOT NULL,
    "fat" DECIMAL(7,1) NOT NULL,
    "carbs" DECIMAL(7,1) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "food_log_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "food_products_owner_id_idx" ON "public"."food_products"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "food_products_source_external_id_key" ON "public"."food_products"("source", "external_id");

-- CreateIndex
CREATE INDEX "food_log_entries_user_id_logged_on_idx" ON "public"."food_log_entries"("user_id", "logged_on");

-- AddForeignKey
ALTER TABLE "public"."food_products" ADD CONSTRAINT "food_products_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."food_products" ADD CONSTRAINT "food_products_based_on_product_id_fkey" FOREIGN KEY ("based_on_product_id") REFERENCES "public"."food_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."favorite_foods" ADD CONSTRAINT "favorite_foods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."favorite_foods" ADD CONSTRAINT "favorite_foods_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."food_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."food_log_entries" ADD CONSTRAINT "food_log_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."food_log_entries" ADD CONSTRAINT "food_log_entries_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."food_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
