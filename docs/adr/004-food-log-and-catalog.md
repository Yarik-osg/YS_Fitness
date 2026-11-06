# ADR 004: Food log snapshots and a separate product catalog

- Status: Accepted
- Date: 2026-11-06
- Decision owners: Product / API

## Context

People need to search packaged foods, save their own products, favorite them, and log grams against a meal on a calendar day. The daily totals are compared with the active nutrition target. Open Food Facts is rate-limited, and a later correction to one log line must not rewrite history or a shared product row.

Nutrition, subscriptions, and users already keep their own tables. A domain reads another domain through an exported service.

## Decision

Split the work into `food-catalog` and `food-log`.

`food-catalog` owns `FoodProduct`. Rows are either `OFF` (cached from Open Food Facts, keyed by source and barcode) or `CUSTOM` (owned by one user). Search uses the cache before calling Open Food Facts. The HTTP client sits behind the `OFF_CLIENT` token. The web app does not call Open Food Facts.

`food-log` owns favorites and log entries. It calls the catalog service and `NutritionService.getActiveTarget`. It does not query nutrition or product tables itself.

Each log entry stores the product name, image, grams, and kcal, protein, fat, and carbs. That snapshot is what history and the daily total use, including after the product is edited or deleted.

`loggedOn` is the `YYYY-MM-DD` string from the client, stored as a SQL date. The server does not shift it by timezone.

Changing kcal, protein, fat, carbs, grams, or meal updates that entry only. Grams-only edits rescale the entry's current snapshot. A macro sent in the same request replaces the rescaled value. `saveAsMyProduct` inserts a new `CUSTOM` product in the same transaction, with per-100g values taken from the edited entry and `basedOnProductId` set to the previous product, then points the entry at the copy. An `OFF` row is not updated.

Every `/food` route requires a JWT and an active subscription.

## Consequences

### Positive

- History stays stable when a shared product changes.
- Open Food Facts traffic stays on the server and is skipped when the cache already matches.
- Nutrition remains the only writer of nutrition targets. The log only reads the active one.

### Negative

- A text search that already has any cached match does not ask Open Food Facts for newer products.
- The active target is read as stored. Opening the food log does not refresh a calculation.
- Per-100g values derived from a small gram amount are rounded to 2 decimals, and the entry snapshot is rounded to 1 decimal.

## Alternatives considered

- One module and one set of tables: rejected because the catalog and the log change for different reasons, and the log must not write nutrition tables.
- Mutating the Open Food Facts row when the user edits a log: rejected because that row is shared and would change other people's history.
- Storing `loggedOn` as a timestamp in the profile timezone: rejected because the client already chose the calendar day.

## References

- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- Open Food Facts search and product API
