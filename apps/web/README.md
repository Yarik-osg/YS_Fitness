# Web

Next.js App Router application for the public site, browser authentication, client portal, and trainer administration.

```bash
pnpm --filter web dev
pnpm --filter web build
pnpm --filter web check-types
```

Route groups and feature-folder conventions are documented in the root [CONTRIBUTING.md](../../CONTRIBUTING.md). API response types come from `@repo/shared-types`; form/request schemas come from `@repo/validation`.

Copy [.env.example](.env.example) to `.env.local` for local development.

## Onboarding persistence

The current API persists only date of birth, BMR calculation sex, metric height
and weight, activity level, weight goal, and timezone. Program direction,
current/desired body, design goal, experience, training frequency, focus areas,
current nutrition, meals per day, and eating habits remain in the browser draft
and result preview only. Health restrictions are not collected yet. These
answers must not be mapped to unrelated profile fields; they need dedicated
backend contracts in a future programs/nutrition milestone.
