# YS Fitness

Personal-training SaaS monorepo with a Next.js web app and NestJS API backed by PostgreSQL and Prisma. Current product flows include email/password authentication, rotating refresh sessions, onboarding, profiles, assigned training programs, workout logging, and subscriptions with mock checkout.

Read [ARCHITECTURE.md](ARCHITECTURE.md) for domain boundaries and [CONTRIBUTING.md](CONTRIBUTING.md) before adding a module. Decisions with long-term impact are recorded in [docs/adr](docs/adr).

## Workspace

- `apps/api` — NestJS REST API
- `apps/web` — Next.js App Router web application
- `apps/mobile` — planned Expo client. It is not part of this workspace yet and will be added later.
- `packages/shared-types` — public API-contract types (never Prisma models)
- `packages/validation` — shared Zod request schemas
- `packages/i18n` — shared internationalization messages and locale utilities
- `packages/ui` — optional shared React components
- `packages/eslint-config` — shared ESLint configurations
- `packages/typescript-config` — shared TypeScript configs for base, Next.js, and React packages

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
- `GET /api/v1/users/me/measurements`
- `POST /api/v1/users/me/measurements`
- `GET /api/v1/users/me/progress-photos`
- `POST /api/v1/users/me/progress-photos`
- `GET /api/v1/users/me/progress-photos/:photoId`
- `DELETE /api/v1/users/me/progress-photos/:photoId`
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

`GET /api/v1/users/me/measurements` and `POST /api/v1/users/me/measurements` are bearer-authenticated and do not require an active subscription. The list returns the latest 1000 rows as `measurements` (`measuredAt` ascending, `id` descending) plus `firstMeasurement`, the earliest row or `null`. `weightKg` on this response is a JSON number. `POST` accepts only `{ weightKg }` and rejects any other field, including `measuredAt`. The server sets the timestamp and always appends a row. `GET /users/me` still returns the single latest measurement, now chosen by `measuredAt` then `id`, with `weightKg` as a decimal string. `GET /api/v1/users/me/progress-photos` and `POST /api/v1/users/me/progress-photos` are bearer-authenticated and do not require a subscription. A photo is a JPEG, PNG, or WebP of at most 400 KB with a longest edge of 1024 pixels, and a user can keep 8. The server decodes the file, writes a JPEG under `PROGRESS_PHOTO_DIR` (default `apps/api/storage/progress-photos`, gitignored), and stores a relative key, width, and height. `GET /api/v1/users/me/progress-photos/:photoId` returns the JPEG only to the owner. `DELETE /api/v1/users/me/progress-photos/:photoId` removes the file first and returns 204 only after that succeeds and the row is gone. If the file cannot be removed, the row stays and the response is 500 `PHOTO_DELETE_FAILED`, so the same request can be retried. A missing file is already gone, and the row is then deleted. The insert locks the user row before it counts. If the insert fails, the new file is deleted. Databases that still have `progress_photos.image` keep those bytes: `pnpm db:migrate` adds nullable file columns and stops before dropping `image` while any row has no file. `pnpm --filter api backfill:progress-photos` copies each bytea value into `PROGRESS_PHOTO_DIR` and records the key only after the file reads back unchanged. Run `pnpm db:migrate` again to drop `image`. A failed backfill does not remove the bytes, and running it again writes the same key. An empty database applies both migrations in one deploy. An iPhone HEIC or HEIF file is converted to JPEG in the browser before upload. The server still rejects a HEIC body. The API process is not in Docker Compose today, so the directory is on the host. If the API is later containerized, mount that directory. Local files are not a backup.

`GET /api/v1/programs/assigned` (JWT + active subscription) returns `{ program }` with template metadata, including `ProgramTemplate.name` from the CSV subtitle, plus `nextDayNumber`, `programProgress`, and `dayLogCounts`. `/profile` reads that summary. The dashboard, `/training`, and `/workout` read the same cycle fields from `GET /api/v1/programs/me`.

`GET /api/v1/programs/promotion` (JWT + active subscription) returns `null` until `programProgress.completed` reaches `expected`. At the target it returns one offer. A beginner moves to the intermediate template with the same gender, weekly frequency, and accent; an intermediate member moves to the matching advanced template. An advanced member is offered the other advanced accents for that gender and frequency, ordered by template code, excluding the current accent. An accent is included only when it maps back to an allowed focus. The offer may have an empty `suggestions` list, and that writes nothing. `POST /api/v1/programs/promotion` with `{ templateId }` accepts one of those suggestions inside a serializable transaction. It updates onboarding experience (advanced stays advanced) and focus, then assigns that template with a new `assignedAt`, so the visible count returns to `0 / expected` and older logs stay. A level-up keeps the current focus when it already maps to the same accent; a zone change sets the canonical focus for the chosen accent. A template id that is missing or no longer eligible is `400` `PROMOTION_NOT_AVAILABLE` and rolls the write back. A serialization conflict (`P2034`) retries the whole transaction once. The dashboard and the workout completion screen open a sheet when the loaded program is already at the target. Closing it sends nothing. Confirming is disabled while the request is in flight. A failed load shows an error and leaves the current program in place.

## Workouts

- `POST /api/v1/workouts/log` — JWT + active subscription; saves the sets just performed for one program day. Each set must match an exercise and order on that day, use a set number within the prescribed sets, and appear once (also enforced by a unique index on log, order, and set number). Reps are 1–999; weight is optional, above 0 and at most 999 kg with two decimals. Unfilled sets may be left out
- `GET /api/v1/workouts/logs` — JWT; paginated history, newest first, used for the previous-session comparison
- `GET /api/v1/workouts/strength` — JWT; each exercise's heaviest set on its earliest and latest logged session, from the full history. A single session, a zero weight, or an unchanged weight is left out. The largest increase is first
- `GET /api/v1/workouts/calendar?from=&to=` — JWT; the caller's logs with `completedAt` in `[from, to)`, oldest first, each with its sets. `from` and `to` are ISO instants and the range is at most 43 days (a six-week grid plus a day for a DST change). Read-only, so it does not need an active subscription

The next program day rotates forward from the latest log for the assigned template since `assignedAt` and wraps after `frequencyPerWeek`, so a reassignment starts again at day 1. `programProgress.completed` counts logs for that template since `assignedAt`; `expected` is `frequencyPerWeek × 8`. `dayLogCounts` is that same window split by day. `/training` lists every assigned day with that count. Day cards start collapsed except the next day, and only that day starts a session at `/workout`. The workout screen starts with a fixed, disabled joint warm-up card, and days that the program marks with an abs add-on (`allowsAbsAddon`, the CSV's "Прес+") get a fixed, disabled abs card after the marked exercise. Both are unnumbered, have nothing to fill in, and are not counted or logged. Abs is no longer a training focus option in onboarding; answers stored earlier still match a template. The dashboard training card links to `/training`. The hero start button still opens `/workout` for the next day. Completing an exercise opens the next one and smoothly scrolls it to just under the sticky header (instantly when the user prefers reduced motion); opening a card by hand never scrolls. Exercise names come from the API as `name` (Ukrainian) and `nameEn`; the web app shows `nameEn` in the English locale and falls back to `name` when it is empty. After a save, the completion screen shows each submitted exercise with this session's sets and, when a prior log matches the same template, day, and exercise, the previous session's sets. There is no duration. Between the program banner and the day cards, `/training` shows a Monday-first strip for the current week that expands into a month grid (no further than the current month). Days with a logged workout carry a filled dot. Recommended training days for the assigned program carry a cyan outline and a hollow dot, and the selected day says so: Tuesday and Thursday for 2 days a week, Monday, Wednesday and Friday for 3, and Monday, Tuesday, Thursday and Friday for 4. These come from `frequencyPerWeek` in `apps/web/lib/training-schedule.ts`, only from the day the program was assigned, and are not stored or returned by the API. Tapping a day lists that day's workouts with their time and each exercise's sets in the same format as the completion screen, or a line saying nothing was logged. Days are the browser's local days, not the profile timezone: the client sends the local midnight bounds of the visible range to `GET /workouts/calendar`.

## Subscriptions

- `GET /api/v1/subscriptions/plans` — public catalog
- `POST /api/v1/subscriptions/checkout` — JWT; `{ planId }` reserves a checkout slot, then the mock provider confirms it to `ACTIVE`
- `POST /api/v1/subscriptions/renew` — JWT; `{ planId }` extends an `ACTIVE` period (or starts checkout when none remains). Mock confirmation is immediate, same as checkout
- `GET /api/v1/subscriptions/me` — JWT; `{ subscription }` is the current `PENDING`/`ACTIVE` row plus plan, or `null`
- `POST /api/v1/subscriptions/grant` — JWT + `ADMIN`; `{ userId, planId, expiresAt? }` writes a `MANUAL` `ACTIVE` subscription

Prices are integers in kopiykas. A user may have at most one `PENDING` or `ACTIVE` subscription; that rule is enforced by a PostgreSQL partial unique index. A concurrent second checkout returns `409` with `SUBSCRIPTION_ALREADY_ACTIVE`.

On the web app, landing plan CTAs store `planId` in `sessionStorage`. Guests and users who have not finished onboarding go to `/onboarding`. After the quiz, a guest registers (keeping `planId` when one was chosen) and then `/checkout` confirms a mock payment and links to the dashboard. An onboarded user with a selected plan and no current subscription goes straight to checkout. The dashboard shows the saved name, with the email underneath, and falls back to the email when the profile has no name. It also shows the plan name and period end when a subscription is active. Without one, the training card on the dashboard and `/training` links to `/checkout`. Completed users open `/profile` from the nav and dashboard to view answers, edit height, weight, experience level, goal, and training frequency, and renew. Login may send the browser back to a safe internal `next` path, including query strings.

See [ARCHITECTURE.md](ARCHITECTURE.md#subscriptions) for the payment-provider token and index details.

## Coach

`GET /api/v1/coach/clients` and `GET /api/v1/coach/clients/:userId` require a bearer JWT with role `ADMIN`. A client token is `403`. A missing bearer is `401`. The `ys_web_session` cookie is not read. `:userId` must be a UUID or the response is `400` `VALIDATION_ERROR`. An unknown id, or an admin id, is `404` `CLIENT_NOT_FOUND`. `ADMIN` is the only coach account. `ProgramOrigin.TRAINER` is a template origin, not a user role.

The list returns client accounts only, newest `createdAt` then `id`, including archived clients. Each summary is `id`, `email`, `name`, `createdAt`, `onboardingCompleted`, `programAssigned`, `programName`, `lastWorkoutAt`, `archived`, `subscriptionOnFile`, and `subscriptionActive`. `programName` is the assigned template name, or null. `lastWorkoutAt` is the latest workout `completedAt`, or null. `archived` is true when the client can no longer sign in. `subscriptionOnFile` is true when any subscription row exists. The detail repeats `archived` and adds `profile`, `onboarding`, `program`, `subscription`, and `note`. Profile, onboarding, program, and subscription are `null` when that row is missing. `note` is a string, empty when the coach has not written one. Profile is birth date, calculation sex, height, activity, weight goal, and timezone. Onboarding is the saved quiz without row ids. Program is the assigned template's accent, code, CSV subtitle (`name`), level, frequency, gender, and `assignedAt`. Subscription is the latest row by `createdAt`, with `active`, `status`, `planName`, and `currentPeriodEnd`. `active` means `ACTIVE` and `currentPeriodEnd` still in the future, the same rule as subscription access. This read does not expire lapsed rows. Password hashes, sessions, tokens, `providerReference`, `grantedByUserId`, health restrictions, and the coach note are left out of every client-facing response. `PATCH /api/v1/coach/clients/:userId/note` with `{ note, base }` saves the private note. `note` and `base` are strings of at most 2000 characters. An empty `note` clears it. The write matches `base` against the stored text, and a newer save is `409` `NOTE_CONFLICT`. A client token is `403`. A missing user or a non-client is `404` `CLIENT_NOT_FOUND`. The detail route does not include measurements, progress photos, or workout logs.

`POST /api/v1/coach/clients/:userId/archive` returns `200` `{ id }`. The same admin guard and client check apply: a client token is `403`, and a missing user or a non-client is `404` `CLIENT_NOT_FOUND`. In one transaction it sets `User.isActive` to false when the client is still active, then revokes open sessions and refresh tokens. Doing it again succeeds and does not rewrite the user. Email, programs, workout logs, subscriptions, measurements, photos, and stored files stay. `POST /api/v1/coach/clients/:userId/restore` uses the same guard and client check and returns `200` `{ id }`. It sets `User.isActive` back to true when the client is archived. An already active client succeeds without a rewrite. It does not create a session, renew a subscription, or grant access. `GET /api/v1/coach/programs/:templateId/clients` returns the current assignees of that template, including archived clients, as the same client summaries plus `programName`. A missing template is `404` `TEMPLATE_NOT_FOUND`. A past workout log is not an assignment.

`GET /api/v1/coach/clients/:userId/workouts` pages that client's logs (`limit` 1–50, default 20, `offset`) newest `completedAt`, then `id`. A page is `logs` and `total`. Each log is `id`, `completedAt`, `dayNumber`, `templateCode`, `templateName`, and `sets`. A set is `order`, `setNumber`, `repsCompleted`, `weightKg`, and the exercise `name` / `nameEn`. Logs are not limited to the current `assignedAt`. The response has no user id, recommendation, or prescribed reps. `GET .../measurements` and `GET .../strength` reuse the client weight chart and strength-change reads. `GET .../progress-photos` is the photo list. `GET .../progress-photos/:photoId` streams that client's JPEG with `Cache-Control: private, no-store`. A photo that belongs to someone else is `404`. None of these JSON bodies include `storageKey`.

On the web, `/coach` is the roster and `/coach/clients/:userId` is that file, including after archive. The roster opens on active clients. Archived clients are a separate list. Archive and restore each ask for confirmation. A failure leaves the client where they were. Column headers sort the loaded roster; on a narrow screen those controls sit above the cards, and Archive sits at the top right of each card. `/coach/programs` shows `assignedCount` in a Clients column: how many users currently have that template, including archived clients. The count opens `/coach/programs/:templateId/clients`. A name in the roster links to the file. That file has the private note and, when the client has no current access and no open checkout, a confirmed manual grant. The grant calls `POST /api/v1/subscriptions/grant` with the signed-in admin and the selected plan. It does not send a custom end date, take a payment, or restore an archived account. An existing active or pending subscription stays as it is and the grant is refused. The header links the YS Fitness mark and Clients back to `/coach`, switches locale, and logs out. Log out calls `POST /auth/logout`. Success clears the session hint and opens `/login`. A failed logout shows the error and stays on the page. `ys_web_session=coach` only tells the proxy and gates where to send an admin. It does not authorize the API. After login, an admin goes to `/coach` instead of onboarding or the client dashboard. An access token keeps the role it was issued with; after the owner account changes from the legacy trainer role to `ADMIN`, that person signs in again or refreshes the session before coach routes accept the token.

## Checks

```bash
pnpm format:check
pnpm lint
pnpm check-types
pnpm build
pnpm test
```

End-to-end tests are `pnpm test:e2e` from the repository root. `pnpm --filter api test:e2e` uses the same database check, then runs Vitest. Both exit when `TEST_DATABASE_URL` is missing or is not a URL with a database name. When `apps/api/.env` defines `DATABASE_URL`, that database name is refused. CI has no API `.env` and supplies its own test URL. Turbo runs the suite with caching off. Apply the schema before the run:

```bash
DATABASE_URL="$TEST_DATABASE_URL" pnpm --filter api exec prisma migrate deploy
TEST_DATABASE_URL="postgresql://..." pnpm test:e2e
```

The e2e run seeds that database before the API boots, because startup refuses an empty exercise catalog.

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
