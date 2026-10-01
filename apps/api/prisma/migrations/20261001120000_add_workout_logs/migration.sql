-- CreateTable
CREATE TABLE "public"."workout_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "day_number" INTEGER NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workout_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workout_log_sets" (
    "id" UUID NOT NULL,
    "workout_log_id" UUID NOT NULL,
    "exercise_id" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "set_number" INTEGER NOT NULL,
    "reps_completed" INTEGER NOT NULL,
    "weight_kg" DECIMAL(6,2),

    CONSTRAINT "workout_log_sets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workout_logs_user_id_completed_at_idx" ON "public"."workout_logs"("user_id", "completed_at");

-- CreateIndex
CREATE INDEX "workout_log_sets_workout_log_id_idx" ON "public"."workout_log_sets"("workout_log_id");

-- AddForeignKey
ALTER TABLE "public"."workout_logs" ADD CONSTRAINT "workout_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workout_logs" ADD CONSTRAINT "workout_logs_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."program_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workout_log_sets" ADD CONSTRAINT "workout_log_sets_workout_log_id_fkey" FOREIGN KEY ("workout_log_id") REFERENCES "public"."workout_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workout_log_sets" ADD CONSTRAINT "workout_log_sets_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
