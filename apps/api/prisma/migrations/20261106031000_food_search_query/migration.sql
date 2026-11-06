-- CreateTable
CREATE TABLE "public"."food_search_queries" (
    "query_key" VARCHAR(100) NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "food_search_queries_pkey" PRIMARY KEY ("query_key")
);
