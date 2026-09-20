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

`PUT /users/me/onboarding` persists the calculation subset on `UserProfile` /
`BodyMeasurement` and the rest of the quiz on `OnboardingResponses` in one
request. Selecting program direction (female/male) writes `programTrack` and
also `biologicalSexForCalculation`. Design goal (`mainGoal`) stays distinct
from the profile weight goal. Health restrictions are not collected yet.

The browser draft in `sessionStorage` (`ys-onboarding-draft`) is only a
working copy until submit. It is scoped to the signed-in user; register and
logout clear it so a new account does not inherit the previous quiz.
`GET /users/me/onboarding-responses` can read the saved quiz later; cross-device
resume is not built yet.

## Session chrome

The landing nav reads the `ys_web_session` hint. Guests see Log in; users
still in onboarding see Continue (`/onboarding`); completed users see
Dashboard (`/dashboard`). The dashboard YS mark links to the landing page.
