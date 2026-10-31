-- CreateEnum
CREATE TYPE "public"."NutritionActivity" AS ENUM ('SEDENTARY', 'MODERATE', 'HIGH', 'VERY_HIGH');

-- CreateEnum
CREATE TYPE "public"."NutritionGoal" AS ENUM ('LOSE_WEIGHT', 'MAINTAIN', 'GAIN_MUSCLE', 'RECOMPOSITION');

-- CreateEnum
CREATE TYPE "public"."NutritionTargetSource" AS ENUM ('CALCULATED', 'MANUAL');

-- CreateTable
CREATE TABLE "public"."nutrition_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "activity" "public"."NutritionActivity" NOT NULL,
    "goal" "public"."NutritionGoal" NOT NULL,
    "preferences" VARCHAR(500),
    "allergies" VARCHAR(500),
    "dislikes" VARCHAR(500),
    "meal_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nutrition_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."nutrition_calculations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "weight_kg" DECIMAL(6,2) NOT NULL,
    "height_cm" DECIMAL(5,2) NOT NULL,
    "age_years" INTEGER NOT NULL,
    "sex" "public"."BiologicalSexForCalculation" NOT NULL,
    "activity" "public"."NutritionActivity" NOT NULL,
    "frequency" INTEGER NOT NULL,
    "goal" "public"."NutritionGoal" NOT NULL,
    "activity_multiplier" DECIMAL(4,2) NOT NULL,
    "goal_adjustment" DECIMAL(6,3) NOT NULL,
    "bmr" DECIMAL(24,12) NOT NULL,
    "tdee" DECIMAL(24,12) NOT NULL,
    "target_calories" DECIMAL(24,12) NOT NULL,
    "protein_grams" DECIMAL(24,12) NOT NULL,
    "fat_grams" DECIMAL(24,12) NOT NULL,
    "carbs_grams" DECIMAL(24,12) NOT NULL,
    "carbs_non_positive" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nutrition_calculations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."nutrition_targets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "source" "public"."NutritionTargetSource" NOT NULL,
    "calculation_id" UUID,
    "target_calories" DECIMAL(24,12) NOT NULL,
    "protein_grams" DECIMAL(24,12) NOT NULL,
    "fat_grams" DECIMAL(24,12) NOT NULL,
    "carbs_grams" DECIMAL(24,12) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nutrition_targets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nutrition_profiles_user_id_key" ON "public"."nutrition_profiles"("user_id");

-- CreateIndex
CREATE INDEX "nutrition_calculations_user_id_created_at_idx" ON "public"."nutrition_calculations"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "nutrition_targets_user_id_created_at_idx" ON "public"."nutrition_targets"("user_id", "created_at");

-- One active target per user. Prisma cannot model the WHERE clause.
CREATE UNIQUE INDEX "nutrition_one_active_target"
ON "public"."nutrition_targets" ("user_id")
WHERE "active";

-- AddForeignKey
ALTER TABLE "public"."nutrition_profiles" ADD CONSTRAINT "nutrition_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."nutrition_calculations" ADD CONSTRAINT "nutrition_calculations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."nutrition_targets" ADD CONSTRAINT "nutrition_targets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."nutrition_targets" ADD CONSTRAINT "nutrition_targets_calculation_id_fkey" FOREIGN KEY ("calculation_id") REFERENCES "public"."nutrition_calculations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
