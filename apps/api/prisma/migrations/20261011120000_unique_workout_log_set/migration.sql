-- DropIndex
DROP INDEX "public"."workout_log_sets_workout_log_id_idx";

-- CreateIndex
CREATE UNIQUE INDEX "workout_log_sets_workout_log_id_order_set_number_key" ON "public"."workout_log_sets"("workout_log_id", "order", "set_number");
