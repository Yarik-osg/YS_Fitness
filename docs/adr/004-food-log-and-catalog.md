# ADR 004: Food log snapshots and a separate product catalog

- Status: Accepted
- Date: 2026-11-06
- Decision owners: Product / API

## Context

People need to search packaged foods, save their own products, favorite them, and log grams against a meal on a calendar day. The daily totals are compared with the active nutrition target. Open Food Facts is rate-limited, and a later correction to one log line must not rewrite history or a shared product row.

Nutrition, subscriptions, and users already keep their own tables. A domain reads another domain through an exported service.

## Decision

Split the work into `food-catalog` and `food-log`.

`food-catalog` owns `FoodProduct` and `FoodSearchQuery`. Rows are either `OFF` (cached from Open Food Facts, keyed by source and barcode) or `CUSTOM` (owned by one user). The HTTP client sits behind the `OFF_CLIENT` token, and that implementation also holds the in-process outbound budget. The web app does not call Open Food Facts.

`food-log` owns favorites and log entries. It calls the catalog service and `NutritionService.getActiveTarget`. It does not query nutrition tables. The catalog does not read favorites or log rows, and it does not import the log module.

`FoodProductResponse.isFavorite` is filled by the log module for the signed-in user. The catalog returns the product without that flag. Search and creating a custom product are HTTP routes on the log controller so the flag can be added without a cycle: one `favorite_foods` lookup for the ids in the response. A brand-new product is not a favorite. `GET /food/favorites` is newest first and every row is a favorite. `PATCH` of a log entry still returns the entry, not a product. A day entry's `isFavorite` comes from that same lookup, so a logged product can be favorited without changing its snapshot.

`GET /food/recent` lists distinct products the caller logged, newest log first. `productId` null is skipped. Grams, meal, and date come from that latest entry so the client can log the same amount again. Per-100g values come from the product row now, not from the entry snapshot. A product the caller cannot see is excluded in the same query.

Each log entry stores the product name, image, grams, and kcal, protein, fat, and carbs. That snapshot is what history and the daily total use, including after the product is edited or deleted.

`loggedOn` is the `YYYY-MM-DD` string from the client, stored as a SQL date. The server does not shift it by timezone.

Changing kcal, protein, fat, carbs, grams, or meal updates that entry only. The read, the new snapshot, and the write happen in one transaction after `SELECT … FOR UPDATE` on that row, so two parallel edits cannot both copy a stale snapshot. Grams-only edits rescale the entry's current snapshot. A macro sent in the same request replaces the rescaled value. `saveAsMyProduct` inserts a new `CUSTOM` product in that same transaction, with per-100g values taken from the edited entry and `basedOnProductId` set to the previous product, then points the entry at the copy. An `OFF` row is not updated.

The shared caps are physical, not the column widths: 0.1 to 5000 g, at most 1000 kcal and 100 g of protein, fat, or carbs per 100 g. An entry can therefore hold at most 50000 kcal and 5000 g of each macro. A patch whose numbers exceed `cap per 100 g × grams / 100` is `400` `FOOD_VALUES_OUT_OF_RANGE`. Those caps land on a 1-decimal number for every 1-decimal gram amount, so half-up rounding cannot push a valid entry over the cap. Open Food Facts rows that fail the same per-100g schema are dropped. One failed cache write does not fail the search.

Search calls are limited in two different places. The route allows 30 searches a minute per address, including answers served from cache, so a burst cannot overwhelm the API. Leaving Open Food Facts is a separate gate. Each user may trigger 3 text searches a minute (`FOOD_SEARCH_USER_OFF_CALLS_PER_MIN`). The process may make 10 (`OFF_SEARCH_BUDGET_PER_MIN`). Barcode lookups stay on their own budget of 100 a minute. The user check runs first and the process bucket second, and a refusal from either one does not spend the other. The gate runs only after the local lookup and the 24-hour query cache, so a cached search spends nothing. A refused call returns the local rows with `fromCacheOnly: true` and does not answer `429`. A query Open Food Facts answered in the last 24 hours is not sent again, and that full answer keeps `fromCacheOnly` false. A barcode already stored is not sent again, and that answer also keeps `fromCacheOnly` false. The flag is true when a limit refused the outbound call, and also when that call failed but this query already matched local rows. A failed call with nothing saved is still an error and does not record the query. Either way a failed call spends the user and process tokens, because Open Food Facts already counted the request. Text search goes to `OFF_SEARCH_URL` (`https://search.openfoodfacts.org` by default), not the legacy `cgi/search.pl` route, which was returning 503 while the product API still answered barcodes. The query key folds case, spaces, and hyphens. A whole query that is only a Cyrillic brand spelling (`кока кола`, `снікерс`, and a few others) is sent as the Latin name Open Food Facts indexes. A separate curated product source was not added: those products already exist in Open Food Facts, and a second row with the same barcode would be a duplicate. There is no verified nutrition table for products the search service does not return. The buckets are in memory behind `OffOutboundLimiter`, so a second API instance needs Redis before the limits are shared. Idle user keys are dropped after a quiet minute.

Every `/food` route requires a JWT and an active subscription.

## Barcode addendum

A search barcode is trimmed to digits of length 8, 12, or 13 and must pass the GS1 mod-10 check. A 12-digit UPC-A is stored and queried as the EAN-13 with a leading 0. EAN-8 stays 8 digits. Anything else is `400` `INVALID_BARCODE` when that is the only invalid field, otherwise the usual `VALIDATION_ERROR`.

When `barcode` is present it wins over `q`. The order is the caller’s `CUSTOM` row with that `barcode` column, then an `OFF` row whose `externalId` is the normalized code or the legacy 12-digit form, then a fresh `FoodSearchQuery` row keyed `barcode:<code>`. Only then does the outbound gate run. A definitive miss is recorded for 24 hours and the next scan does not leave the process. That miss is an HTTP 404 whose JSON body has `status` 0 (`product not found`), an HTTP 200 with `status` 0, or a product with no name, no kcal, or values over the per-100g caps. A 404 that is not that JSON, any other non-OK response, a timeout, a network error, or bad JSON stays `OFF_UNAVAILABLE`: the answer is local with `fromCacheOnly: true` and nothing is written. A spent user or process allowance does the same. Cache hits spend neither allowance. The user allowance is `FOOD_BARCODE_USER_OFF_CALLS_PER_MIN` (default 20). The process allowance stays 100. Checking the user first means a process denial does not consume the user’s token, and a user denial does not consume the process token. Barcode scans use the same 30-per-minute route throttle as text search.

`barcode` is its own column. `externalId` stays the Open Food Facts identity and is null on every custom row, so the `(source, externalId)` unique index still allows many custom foods with no code. One custom barcode per user is `food_products_custom_barcode_key` on `(owner_id, barcode) WHERE source = 'CUSTOM' AND barcode IS NOT NULL`. Prisma cannot model that predicate, so the index is only in the migration SQL. `prisma migrate deploy` (what CI runs) applies the file and does not drop it. `prisma db push` and a schema-only rebuild would. `FoodBarcodeIndexCheck` reads the catalog at startup and refuses to boot without that index, the same way nutrition and subscriptions guard theirs. Do not accept a generated migration that drops the index. Two users may share a code. `saveAsMyProduct` copies an Open Food Facts `externalId` onto the new custom row when it is a valid barcode and this user does not already own that code; otherwise the copy’s barcode stays null. Two copies in flight can both pass that check. The insert then runs after `SAVEPOINT food_copy_barcode` on the same transaction. A unique violation on `(owner_id, barcode)` rolls back to that savepoint and inserts the copy with a null barcode, so the log update after it still runs. Postgres would otherwise abort the whole transaction (`25P02`) and drop the kcal or gram edit. A unique violation on any other constraint is rolled back to the savepoint and rethrown unchanged. A copy of a custom product gets no barcode. The response field `barcode` is the custom column, or `externalId` for an Open Food Facts row.

## Consequences

### Positive

- History stays stable when a shared product changes.
- Open Food Facts traffic stays on the server and is skipped when that exact search is still fresh, the barcode is already cached, or the process budget is spent.
- Nutrition remains the only writer of nutrition targets. The log only reads the active one.

### Negative

- The outbound budgets are per process. A second API instance gets its own 10 searches a minute until `OffOutboundLimiter` moves to Redis.
- The active target is read as stored. Opening the food log does not refresh a calculation.
- Per-100g values derived from a small gram amount are rounded to 2 decimals, and the entry snapshot is rounded to 1 decimal.

## Alternatives considered

- One module and one set of tables: rejected because the catalog and the log change for different reasons, and the log must not write nutrition tables.
- Mutating the Open Food Facts row when the user edits a log: rejected because that row is shared and would change other people's history.
- Storing `loggedOn` as a timestamp in the profile timezone: rejected because the client already chose the calendar day.

## References

- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- Open Food Facts search and product API
