# YS Fitness

Personal-training SaaS monorepo. This milestone provides a Next.js web shell and a NestJS API with PostgreSQL, Prisma, email/password authentication, rotating refresh sessions, onboarding, and mock subscription checkout.

Read [ARCHITECTURE.md](ARCHITECTURE.md) for domain boundaries and [CONTRIBUTING.md](CONTRIBUTING.md) before adding a module. Decisions with long-term impact are recorded in [docs/adr](docs/adr).

## Workspace

- `apps/api` — NestJS REST API
- `apps/web` — Next.js App Router web application
- `apps/mobile` — planned Expo client (not created yet)
- `packages/shared-types` — public API-contract types (never Prisma models)
- `packages/validation` — shared Zod request schemas
- `packages/ui` — optional shared React components

## Local setup

Requirements: Node.js 20+, pnpm 10, and a Docker-compatible runtime. On macOS, [OrbStack](https://orbstack.dev/) is the recommended lightweight runtime; Docker Desktop is also supported. This repository uses the modern `docker compose` plugin syntax.

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

Set real random values for all secret variables and change the trainer seed password before running the seed. `pnpm db:seed` is explicit and idempotent; it also upserts the two catalog plans (`3_MONTHS` at 2490 ₴ and `1_MONTH` at 990 ₴, stored in kopiykas). Application startup never seeds data.

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

PostgreSQL data persists in the named `postgres_data` volume. The Compose file is structured so Redis can be added under `services` when queues and caching are implemented.

## Authentication endpoints

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/users/me`
- `PUT /api/v1/users/me/onboarding`

Passwords require at least eight characters and are hashed with Argon2. Access JWTs contain only `sub`, `sessionId`, `role`, `iat`, and `exp`. Refresh JWTs are rotated once, stored only as SHA-256 digests, and tracked as a token family. Reuse of a consumed token revokes the entire session.

Browser requests use `clientType: "WEB"`. Refresh tokens are sent only in an HttpOnly cookie; fetch requests must use `credentials: "include"`. Cookie-authenticated refresh and logout requests enforce trusted origins. If `COOKIE_SAME_SITE=none`, the browser must copy the readable CSRF cookie value into the `x-csrf-token` header.

Native requests use `clientType: "MOBILE"` and receive the refresh token in the response body for storage in Expo SecureStore. Requests with a browser `Origin`/`Referer` cannot select mobile body transport.

## Onboarding

`PUT /api/v1/users/me/onboarding` is bearer-authenticated and stores raw questionnaire data only. It upserts `UserProfile` and appends a `BodyMeasurement` when weight/body-fat data changed. An identical retry does not duplicate the measurement. Calorie targets and generated programs are deliberately separate future modules.

## Subscriptions

- `GET /api/v1/subscriptions/plans` — public catalog
- `POST /api/v1/subscriptions/checkout` — JWT; `{ planId }` creates a `PENDING` row, then the mock provider confirms it to `ACTIVE`
- `GET /api/v1/subscriptions/me` — JWT; `{ subscription }` is the current `PENDING`/`ACTIVE` row plus plan, or `null`
- `POST /api/v1/subscriptions/grant` — JWT + `TRAINER`/`ADMIN`; `{ userId, planId, expiresAt? }` writes a `MANUAL` `ACTIVE` subscription

Prices are integers in kopiykas. A user may have at most one `PENDING` or `ACTIVE` subscription; that rule is enforced by a PostgreSQL partial unique index. A concurrent second checkout returns `409` with `SUBSCRIPTION_ALREADY_ACTIVE`.

On the web app, landing plan CTAs store `planId` (query + `sessionStorage`). Guests go to register, new users finish onboarding, then `/checkout` posts and shows confirmation. Already-onboarded logins with a selected plan skip straight to checkout. Dashboard shows plan name and period end.

See [ARCHITECTURE.md](ARCHITECTURE.md#subscriptions) for the payment-provider token and index details.

## Checks

```bash
pnpm format:check
pnpm check-types
pnpm lint
pnpm test
pnpm build
```

End-to-end tests require a separate migrated PostgreSQL database:

```bash
DATABASE_URL="$TEST_DATABASE_URL" pnpm --filter api exec prisma migrate deploy
TEST_DATABASE_URL="postgresql://..." pnpm --filter api test:e2e
```

Husky runs staged formatting/linting and affected type checks before commits, commitlint enforces Conventional Commits, and affected tests run before pushes. Pull requests repeat all gates in GitHub Actions with a PostgreSQL service.

## Branches and pull requests

Use `feature/`, `fix/`, `chore/`, `docs/`, or `refactor/` prefixes followed by kebab-case. Each major domain—subscriptions, nutrition, programs, workouts, media, and admin—gets its own focused branch and pull request. See [CONTRIBUTING.md](CONTRIBUTING.md) for examples and the review checklist.

## Intentional deferrals

- Email verification
- OAuth and two-factor authentication
- Relational health-restriction records (currently validated JSON tags)
- Goal-history tracking (the profile stores the current goal)
- Nutrition target calculation
- Workout-program generation
- WayForPay HTTP, webhooks, signatures, and hosted checkout
- Dunning, invoices, refunds, and proration
