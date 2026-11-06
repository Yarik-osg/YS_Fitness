-- Supports the recent list: latest log row per product for one user.
CREATE INDEX "food_log_entries_user_id_product_id_created_at_idx"
ON "public"."food_log_entries" ("user_id", "product_id", "created_at" DESC);
