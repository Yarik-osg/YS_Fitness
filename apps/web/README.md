# Web

Next.js App Router application for the public site, browser authentication, client portal, and trainer administration.

```bash
pnpm --filter web dev
pnpm --filter web build
pnpm --filter web check-types
```

Route groups and feature-folder conventions are documented in the root [CONTRIBUTING.md](../../CONTRIBUTING.md). API response types come from `@repo/shared-types`; form/request schemas come from `@repo/validation`.

Copy [.env.example](.env.example) to `.env.local` for local development.

## Checkout

Landing plan buttons load prices from `GET /subscriptions/plans` and persist the selected `planId` in the URL and `sessionStorage` (`ys_selected_plan_id`). Guests go to `/register?planId=`; users who have not finished onboarding go to `/onboarding`; onboarded users with no current subscription go to `/checkout`. `/checkout` is a protected client route: it posts `POST /subscriptions/checkout` (mock confirmation, no card form) and then links to the dashboard.

## Onboarding persistence

The current API persists only date of birth, BMR calculation sex, metric height
and weight, activity level, weight goal, and timezone. Program direction,
current/desired body, design goal, experience, training frequency, focus areas,
current nutrition, meals per day, and eating habits remain in the browser draft
and result preview only. Health restrictions are not collected yet. These
answers must not be mapped to unrelated profile fields; they need dedicated
backend contracts in a future programs/nutrition milestone.
