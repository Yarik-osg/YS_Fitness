# YS Fitness

Personal-training SaaS monorepo with a Next.js web app and NestJS API backed by PostgreSQL and Prisma. Current product flows include email/password authentication, rotating refresh sessions, onboarding, profiles, assigned training programs, workout logging, and subscriptions with mock checkout.

Read [ARCHITECTURE.md](ARCHITECTURE.md) for domain boundaries and [CONTRIBUTING.md](CONTRIBUTING.md) before adding a module. Decisions with long-term impact are recorded in [docs/adr](docs/adr).

## Workspace

- `apps/api` — NestJS REST API
- `apps/web` — Next.js App Router web application
- `apps/mobile` — planned Expo client (not created yet)
- `packages/shared-types` — public API-contract types (never Prisma models)
- `packages/validation` — shared Zod request schemas
- `packages/i18n` — shared internationalization messages and locale utilities
- `packages/ui` — optional shared React components
- `packages/eslint-config` — shared ESLint configurations

## Local setup

Requirements: Node.js 24 (see `.nvmrc`), pnpm 10, and a Docker-compatible runtime. On macOS, [OrbStack](https://orbstack.dev/) is the recommended lightweight runtime; Docker Desktop is also supported. This repository uses the modern `docker compose` plugin syntax.

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
pnpm install
pnpm docker:up
pnpm db:migrate
pnpm db:seed
pnpm dev
```

The web app runs at `http://localhost:3000`; the API runs at `http://localhost:3001/api/v1`. Swagger is available at `/api/v1/docs`, and health checks use `GET /api/v1/health`.

Set real random values for all secret variables and change the trainer seed password before running the seed. `pnpm db:seed` is explicit and idempotent; it also upserts the catalog plans (`1_MONTH` at 990 ₴, `3_MONTHS` at 2490 ₴, and `FULL_ACCESS` at 3490 ₴, stored in kopiykas). Application startup never seeds data.

`pnpm db:migrate` and `pnpm db:seed` are one deployment step. A fresh migration has no exercise or template rows, and the reps migration fills any existing exercises with 12/12 until the seed writes the trainer CSV. `ExerciseSeedCheck` runs once when the API starts. It refuses to boot when there are no exercises or no active templates, and when an exercise still at 12/12 is used by an active template. Abs add-on flags are not part of this check. Each exercise in the CSV library carries an English name in its fifth column (`Назва англійською`); the seed refuses a row without one and stores it as `Exercise.nameEn`. The migration adds that column with an empty default, so the seed is what fills it.

### Local containers

The root `.env` owns local container settings. `apps/api/.env` owns the API connection string and must use matching PostgreSQL credentials.

```bash
# Start PostgreSQL and wait for its healthcheck
pnpm docker:up

# Stop containers while preserving database data
pnpm docker:down

# Delete local database data and start a fresh PostgreSQL instance
pnpm docker:reset
```

`pnpm docker:up` also starts Mailpit, a local mail catcher. Read the emails the API sends at `http://localhost:8025`; nothing leaves your machine.

PostgreSQL data persists in the named `postgres_data` volume. The Compose file is structured so Redis can be added under `services` when queues and caching are implemented.

### Testing on mobile devices via ngrok

Free ngrok usually gives one public URL. Point that tunnel at the web app only. Next rewrites `/api/v1/*` to Nest on `localhost:3001`, so the phone uses a single origin. Do not use `--pooling-enabled` to share one URL between ports 3000 and 3001.

1. Start the stack (`pnpm dev`) so web is on 3000 and API is on 3001.
2. Start one tunnel:

```bash
ngrok http 3000
```

3. Copy the `https://….ngrok-free.dev` (or `.ngrok-free.app`) URL with no trailing slash.

`apps/api/.env`

```bash
WEB_ORIGINS=http://localhost:3000,https://<web-tunnel>.ngrok-free.dev
COOKIE_SAME_SITE=lax
```

`apps/web/.env.local`

```bash
NEXT_PUBLIC_API_BASE_URL=/api/v1
```

4. Restart both dev servers (web must restart so `NEXT_PUBLIC_*` is inlined). Open the tunnel URL on the phone, not `localhost` and not port 3001.

When you are done, remove the ngrok origin from `WEB_ORIGINS`, set `NEXT_PUBLIC_API_BASE_URL` back to `http://localhost:3001/api/v1`, and restart again.

`apps/web/next.config.js` allows the common ngrok host wildcards in `allowedDevOrigins` (dev only) and rewrites `/api/v1` to `API_PROXY_TARGET` (default `http://localhost:3001`). Same-origin rewrite keeps `COOKIE_SAME_SITE=lax`.

If you ever use two different public hosts for web and API, set `COOKIE_SAME_SITE=none`. Then login/register/refresh return `csrfToken` in JSON; the page stores it as `ys_csrf` and sends `x-csrf-token`, because it cannot read the API cookie on the other host.

## Welcome email

A successful registration sends one plain-text "account created" email with a link to the login page. It is a notice only: there is no code or link to confirm, and the account works immediately. The email is sent after the account exists and never blocks or fails registration; a delivery error is only logged. Copy lives in `apps/api/src/mail/welcome-email.ts` (uk and en).

Sending uses Nodemailer over SMTP. Set `SMTP_HOST`, `SMTP_PORT`, and, for a real provider, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_SECURE` in `apps/api/.env`, plus `MAIL_FROM`. Leave `SMTP_HOST` empty to disable email. Links use `APP_URL`, or the first `WEB_ORIGINS` entry when it is unset. Use `127.0.0.1` rather than `localhost` for local Mailpit: `localhost` tries IPv6 first and the Docker port mapping can stall for several seconds.

## Password reset

The login page links to `/forgot-password`. The user enters their email and always sees the same message ("if an account exists, we sent a link"), whether or not the account exists. If it does, they get a plain-text email with a link to `/reset-password?token=...`. The link works once and expires after 30 minutes; asking again replaces the earlier link, and the same account gets at most one link per minute. On the reset page the user chooses a new password (8–128 characters), is signed out on every device, receives a "password changed" email, and lands on `/login` with a notice. Only a hash of the token is stored (`password_reset_tokens`). Mail follows the same SMTP settings as the welcome email, and a missing SMTP host means no link can be delivered. Copy lives in `apps/api/src/mail/password-emails.ts` (uk and en).

## Authentication endpoints

- `POST /api/v1/auth/register` — optional `locale` (`uk` or `en`, default `uk`) picks the language of the welcome email
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/password/forgot` — `{ email, locale? }`; always `204`, throttled to 3 a minute
- `POST /api/v1/auth/password/reset` — `{ token, password, locale? }`; `204`, or `400 RESET_TOKEN_INVALID` for an unknown, used, or expired token; throttled to 10 a minute
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/users/me`
- `PUT /api/v1/users/me/onboarding`
- `GET /api/v1/users/me/onboarding-responses`
- `PATCH /api/v1/users/me/profile`

Passwords require at least eight characters and are hashed with Argon2. Access JWTs contain only `sub`, `sessionId`, `role`, `iat`, and `exp`. Refresh JWTs are rotated once, stored only as SHA-256 digests, and tracked as a token family. Reuse of a consumed token revokes the entire session.

Browser requests use `clientType: "WEB"`. Refresh tokens are sent only in an HttpOnly cookie; fetch requests must use `credentials: "include"`. Cookie-authenticated refresh and logout requests enforce trusted origins. When `COOKIE_SAME_SITE=none`, those responses also include `csrfToken`. The web app stores it and sends it back as `x-csrf-token`, because a page on another host cannot read the API cookie.

Native requests use `clientType: "MOBILE"` and receive the refresh token in the response body for storage in Expo SecureStore. Requests with a browser `Origin`/`Referer` cannot select mobile body transport.

## Onboarding

`PUT /api/v1/users/me/onboarding` is bearer-authenticated. It upserts the calculation subset on `UserProfile` (name, date of birth, calculation sex, height, activity, goal, timezone, and restrictions), appends a `BodyMeasurement` when weight or body fat changed, and upserts the rest of the quiz on `OnboardingResponses`. An identical retry does not duplicate the measurement. `GET /api/v1/users/me/onboarding-responses` returns that quiz, or `{ responses: null }` when the user finished onboarding before the table existed. Calorie-target calculation and personalized program generation beyond the existing trainer-managed template catalog and assignment are separate future work.

## Profile

`PATCH /api/v1/users/me/profile` is bearer-authenticated. It accepts any non-empty subset of height, weight, experience, design goal, and training frequency. Height updates `UserProfile`; a changed weight appends a `BodyMeasurement`; the quiz fields update `OnboardingResponses` (or create a stub row when those three quiz fields are sent together and no row exists). Name, date of birth, program track, and calculation sex are not editable here. The profile page shows the level next to its training years (under 6 months, 6–24 months, over 2 years; the years follow the level and are not stored separately), and offers level, goal, and frequency once onboarding answers exist. Saving a changed level or weekly frequency first asks for confirmation, because those answers can switch the program: if a different template matches, it starts from day 1 with the progress counter at 0, and workout history is kept. The same request reassigns or unassigns the workout template only when match-affecting answers changed and the user has active subscription access. Profile, measurements, onboarding answers, and program assign/unassign run in one serializable transaction.

`GET /api/v1/programs/assigned` (JWT + active subscription) returns `{ program }` with template metadata, including `ProgramTemplate.name` from the CSV subtitle, plus `nextDayNumber`, `programProgress`, and `dayLogCounts`. `/profile` reads that summary. The dashboard, `/training`, and `/workout` read the same cycle fields from `GET /api/v1/programs/me`.

## Workouts

- `POST /api/v1/workouts/log` — JWT + active subscription; saves the sets just performed for one program day. Each set must match an exercise and order on that day, use a set number within the prescribed sets, and appear once (also enforced by a unique index on log, order, and set number). Reps are 1–999; weight is optional, above 0 and at most 999 kg with two decimals. Unfilled sets may be left out
- `GET /api/v1/workouts/logs` — JWT; paginated history, newest first, used for the previous-session comparison
- `GET /api/v1/workouts/calendar?from=&to=` — JWT; the caller's logs with `completedAt` in `[from, to)`, oldest first, each with its sets. `from` and `to` are ISO instants and the range is at most 43 days (a six-week grid plus a day for a DST change). Read-only, so it does not need an active subscription

The next program day rotates forward from the latest log for the assigned template since `assignedAt` and wraps after `frequencyPerWeek`, so a reassignment starts again at day 1. `programProgress.completed` counts logs for that template since `assignedAt`; `expected` is `frequencyPerWeek × 8`. `dayLogCounts` is that same window split by day. `/training` lists every assigned day with that count. Day cards start collapsed except the next day, and only that day starts a session at `/workout`. The workout screen starts with a fixed, disabled joint warm-up card, and days that the program marks with an abs add-on (`allowsAbsAddon`, the CSV's "Прес+") get a fixed, disabled abs card after the marked exercise. Both are unnumbered, have nothing to fill in, and are not counted or logged. Abs is no longer a training focus option in onboarding; answers stored earlier still match a template. The dashboard training card links to `/training`. The hero start button still opens `/workout` for the next day. Completing an exercise opens the next one and smoothly scrolls it to just under the sticky header (instantly when the user prefers reduced motion); opening a card by hand never scrolls. Exercise names come from the API as `name` (Ukrainian) and `nameEn`; the web app shows `nameEn` in the English locale and falls back to `name` when it is empty. After a save, the completion screen shows each submitted exercise with this session's sets and, when a prior log matches the same template, day, and exercise, the previous session's sets. There is no duration. Between the program banner and the day cards, `/training` shows a Monday-first strip for the current week that expands into a month grid (no further than the current month). Days with a logged workout carry a filled dot. Recommended training days for the assigned program carry a cyan outline and a hollow dot, and the selected day says so: Tuesday and Thursday for 2 days a week, Monday, Wednesday and Friday for 3, and Monday, Tuesday, Thursday and Friday for 4. These come from `frequencyPerWeek` in `apps/web/lib/training-schedule.ts`, only from the day the program was assigned, and are not stored or returned by the API. Tapping a day lists that day's workouts with their time and each exercise's sets in the same format as the completion screen, or a line saying nothing was logged. Days are the browser's local days, not the profile timezone: the client sends the local midnight bounds of the visible range to `GET /workouts/calendar`.

## Subscriptions

- `GET /api/v1/subscriptions/plans` — public catalog
- `POST /api/v1/subscriptions/checkout` — JWT; `{ planId }` reserves a checkout slot, then the mock provider confirms it to `ACTIVE`
- `POST /api/v1/subscriptions/renew` — JWT; `{ planId }` extends an `ACTIVE` period (or starts checkout when none remains). Mock confirmation is immediate, same as checkout
- `GET /api/v1/subscriptions/me` — JWT; `{ subscription }` is the current `PENDING`/`ACTIVE` row plus plan, or `null`
- `POST /api/v1/subscriptions/grant` — JWT + `TRAINER`/`ADMIN`; `{ userId, planId, expiresAt? }` writes a `MANUAL` `ACTIVE` subscription

Prices are integers in kopiykas. A user may have at most one `PENDING` or `ACTIVE` subscription; that rule is enforced by a PostgreSQL partial unique index. A concurrent second checkout returns `409` with `SUBSCRIPTION_ALREADY_ACTIVE`.

On the web app, landing plan CTAs store `planId` in `sessionStorage`. Guests and users who have not finished onboarding go to `/onboarding`. After the quiz, a guest registers (keeping `planId` when one was chosen) and then `/checkout` confirms a mock payment and links to the dashboard. An onboarded user with a selected plan and no current subscription goes straight to checkout. The dashboard shows the saved name, with the email underneath, and falls back to the email when the profile has no name. It also shows the plan name and period end when a subscription is active. Without one, the training card on the dashboard and `/training` links to `/checkout`. Completed users open `/profile` from the nav and dashboard to view answers, edit height, weight, experience level, goal, and training frequency, and renew. Login may send the browser back to a safe internal `next` path, including query strings.

See [ARCHITECTURE.md](ARCHITECTURE.md#subscriptions) for the payment-provider token and index details.

## Checks

```bash
pnpm format:check
pnpm check-types
pnpm lint
pnpm test
pnpm build
```

End-to-end tests require a separate migrated PostgreSQL database. The e2e run seeds that database before the API boots, because startup refuses an empty exercise catalog:

```bash
DATABASE_URL="$TEST_DATABASE_URL" pnpm --filter api exec prisma migrate deploy
TEST_DATABASE_URL="postgresql://..." pnpm --filter api test:e2e
```

Husky runs staged formatting/linting and affected type checks before commits, commitlint enforces Conventional Commits, and affected tests run before pushes. Pull requests repeat all gates in GitHub Actions with a PostgreSQL service.

## Branches and pull requests

Use `feature/`, `fix/`, `chore/`, `docs/`, or `refactor/` prefixes followed by kebab-case. Each major domain—subscriptions, nutrition, programs, workouts, media, and admin—gets its own focused branch and pull request. See [CONTRIBUTING.md](CONTRIBUTING.md) for examples and the review checklist.

## Intentional deferrals

- Email verification (the welcome email is a notice only; the address is not confirmed)
- OAuth and two-factor authentication
- Relational health-restriction records (currently validated JSON tags)
- Goal-history tracking (the profile stores the current goal)
- Nutrition target calculation
- Personalized workout-program generation beyond the existing template catalog and matching
- WayForPay HTTP, webhooks, signatures, and hosted checkout
- Dunning, invoices, refunds, and proration
