-- CreateEnum
CREATE TYPE "public"."ProgramTrack" AS ENUM ('FEMALE', 'MALE');

-- CreateEnum
CREATE TYPE "public"."OnboardingMainGoal" AS ENUM ('LOSE_WEIGHT', 'BUILD_MUSCLE', 'IMPROVE_BODY', 'MAINTAIN', 'GET_STRONGER');

-- CreateEnum
CREATE TYPE "public"."TrainingExperience" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "public"."NutritionCurrent" AS ENUM ('STRUCTURED', 'BALANCED', 'INTUITIVE', 'IRREGULAR', 'UNCONTROLLED');

-- CreateTable
CREATE TABLE "public"."onboarding_responses" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "program_track" "public"."ProgramTrack" NOT NULL,
    "current_body" VARCHAR(32) NOT NULL,
    "desired_body" VARCHAR(8) NOT NULL,
    "main_goal" "public"."OnboardingMainGoal" NOT NULL,
    "experience" "public"."TrainingExperience" NOT NULL,
    "training_frequency" VARCHAR(8) NOT NULL,
    "focus_areas" TEXT[] NOT NULL,
    "nutrition_current" "public"."NutritionCurrent" NOT NULL,
    "meals_per_day" VARCHAR(16) NOT NULL,
    "eating_habits" TEXT[] NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_responses_user_id_key" ON "public"."onboarding_responses"("user_id");

-- AddForeignKey
ALTER TABLE "public"."onboarding_responses" ADD CONSTRAINT "onboarding_responses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
