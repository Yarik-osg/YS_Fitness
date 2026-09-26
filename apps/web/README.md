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

Landing plan buttons load prices from `GET /subscriptions/plans` and persist the selected `planId` in `sessionStorage` (`ys_selected_plan_id`). Guests and users who have not finished onboarding go to `/onboarding`. After the quiz, guests go to `/register` (with `planId` when one is stored). Onboarded users with no current subscription go to `/checkout?planId=`; users who already have a subscription go to `/dashboard`. `/checkout` is a protected client route with a plan step and a mock payment step (terms plus a local “card added” flag). It posts `POST /subscriptions/checkout` with `{ planId }` only, then links to the dashboard.

## Onboarding persistence

`PUT /users/me/onboarding` persists the calculation subset on `UserProfile` /
`BodyMeasurement` and the rest of the quiz on `OnboardingResponses` in one
request. The profile name comes from that quiz and is shown on the dashboard.
Selecting program direction (female/male) writes `programTrack` and also
`biologicalSexForCalculation`. Design goal (`mainGoal`) stays distinct from
the profile weight goal. Health restrictions are not collected yet. Height
and weight open at 170 cm and 60 kg when the draft has not set them.

The browser draft in `sessionStorage` (`ys-onboarding-draft`) is only a
working copy until submit. It is scoped to the signed-in user; register and
logout clear it so a new account does not inherit the previous quiz.
`GET /users/me/onboarding-responses` can read the saved quiz later; cross-device
resume is not built yet.

## Session chrome

The landing nav reads the `ys_web_session` hint. Guests see Log in; users
still in onboarding see Continue (`/onboarding`); completed users see
Dashboard (`/dashboard`). The dashboard YS mark links to the landing page.
A locale switcher (Ukrainian by default, English) is on every page. The
choice is stored in the `NEXT_LOCALE` cookie, and every URL is prefixed
(`/uk` or `/en`).
