-- CreateEnum
CREATE TYPE "public"."MuscleGroup" AS ENUM ('GLUTES', 'QUADRICEPS', 'HAMSTRINGS', 'BACK', 'BICEPS', 'TRICEPS', 'CHEST', 'SHOULDERS');

-- CreateEnum
CREATE TYPE "public"."ProgramAccent" AS ENUM ('NONE', 'UPPER', 'LOWER');

-- CreateTable
CREATE TABLE "public"."exercises" (
    "id" UUID NOT NULL,
    "code" VARCHAR(16) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "muscle_groups" "public"."MuscleGroup"[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."program_templates" (
    "id" UUID NOT NULL,
    "code" VARCHAR(16) NOT NULL,
    "gender" "public"."ProgramTrack" NOT NULL,
    "level" "public"."TrainingExperience" NOT NULL,
    "frequency_per_week" INTEGER NOT NULL,
    "accent" "public"."ProgramAccent" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "program_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."program_template_days" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "day_number" INTEGER NOT NULL,

    CONSTRAINT "program_template_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."program_template_exercises" (
    "id" UUID NOT NULL,
    "template_day_id" UUID NOT NULL,
    "exercise_id" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "sets" INTEGER NOT NULL,
    "reps_min" INTEGER NOT NULL,
    "reps_max" INTEGER NOT NULL,

    CONSTRAINT "program_template_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workout_programs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workout_programs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exercises_code_key" ON "public"."exercises"("code");

-- CreateIndex
CREATE UNIQUE INDEX "program_templates_code_key" ON "public"."program_templates"("code");

-- CreateIndex
CREATE UNIQUE INDEX "program_templates_identity_key" ON "public"."program_templates"("gender", "level", "frequency_per_week", "accent");

-- CreateIndex
CREATE UNIQUE INDEX "program_template_days_template_id_day_number_key" ON "public"."program_template_days"("template_id", "day_number");

-- CreateIndex
CREATE UNIQUE INDEX "program_template_exercises_template_day_id_order_key" ON "public"."program_template_exercises"("template_day_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "workout_programs_user_id_key" ON "public"."workout_programs"("user_id");

-- AddForeignKey
ALTER TABLE "public"."program_template_days" ADD CONSTRAINT "program_template_days_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."program_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."program_template_exercises" ADD CONSTRAINT "program_template_exercises_template_day_id_fkey" FOREIGN KEY ("template_day_id") REFERENCES "public"."program_template_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."program_template_exercises" ADD CONSTRAINT "program_template_exercises_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workout_programs" ADD CONSTRAINT "workout_programs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workout_programs" ADD CONSTRAINT "workout_programs_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."program_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
