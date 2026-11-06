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

`food-log` owns favorites and log entries. It calls the catalog service and `NutritionService.getActiveTarget`. It does not query nutrition or product tables itself.

Each log entry stores the product name, image, grams, and kcal, protein, fat, and carbs. That snapshot is what history and the daily total use, including after the product is edited or deleted.

`loggedOn` is the `YYYY-MM-DD` string from the client, stored as a SQL date. The server does not shift it by timezone.

Changing kcal, protein, fat, carbs, grams, or meal updates that entry only. The read, the new snapshot, and the write happen in one transaction after `SELECT … FOR UPDATE` on that row, so two parallel edits cannot both copy a stale snapshot. Grams-only edits rescale the entry's current snapshot. A macro sent in the same request replaces the rescaled value. `saveAsMyProduct` inserts a new `CUSTOM` product in that same transaction, with per-100g values taken from the edited entry and `basedOnProductId` set to the previous product, then points the entry at the copy. An `OFF` row is not updated.

The shared caps are physical, not the column widths: 0.1 to 5000 g, at most 1000 kcal and 100 g of protein, fat, or carbs per 100 g. An entry can therefore hold at most 50000 kcal and 5000 g of each macro. A patch whose numbers exceed `cap per 100 g × grams / 100` is `400` `FOOD_VALUES_OUT_OF_RANGE`. Those caps land on a 1-decimal number for every 1-decimal gram amount, so half-up rounding cannot push a valid entry over the cap. Open Food Facts rows that fail the same per-100g schema are dropped. One failed cache write does not fail the search.

Search calls are limited in two different places. The route allows 30 searches a minute per address, including answers served from cache, so a burst cannot overwhelm the API. Leaving Open Food Facts is a separate gate. Each user may trigger 3 text searches a minute (`FOOD_SEARCH_USER_OFF_CALLS_PER_MIN`). The process may make 10 (`OFF_SEARCH_BUDGET_PER_MIN`). Barcode lookups stay on their own budget of 100 a minute. The user check runs first and the process bucket second, and a refusal from either one does not spend the other. The gate runs only after the local lookup and the 24-hour query cache, so a cached search spends nothing. A refused call returns the local rows with `fromCacheOnly: true` and does not answer `429`. A query Open Food Facts answered in the last 24 hours is not sent again, and that full answer keeps `fromCacheOnly` false. A barcode already stored is not sent again. A failed call does not record the query. It does spend the user and process tokens, because Open Food Facts already counted the request. The buckets are in memory behind `OffOutboundLimiter`, so a second API instance needs Redis before the limits are shared. Idle user keys are dropped after a quiet minute.

Every `/food` route requires a JWT and an active subscription.

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
