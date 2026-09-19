# YS Fitness

Personal-training SaaS monorepo. This milestone provides a Next.js web shell and a NestJS API with PostgreSQL, Prisma, email/password authentication, rotating refresh sessions, and onboarding.

Read [ARCHITECTURE.md](ARCHITECTURE.md) for domain boundaries and [CONTRIBUTING.md](CONTRIBUTING.md) before adding a module. Decisions with long-term impact are recorded in [docs/adr](docs/adr).

## Workspace

- `apps/api` — NestJS REST API
- `apps/web` — Next.js App Router web application
- `apps/mobile` — planned Expo client (not created yet)
- `packages/shared-types` — public API-contract types (never Prisma models)
- `packages/validation` — shared Zod request schemas
- `packages/ui` — optional shared React components

## Local setup

Requirements: Node.js 20+, pnpm 10, and Docker.

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
docker compose up -d postgres
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

The web app runs at `http://localhost:3000`; the API runs at `http://localhost:3001/api/v1`. Swagger is available at `/api/v1/docs`, and health checks use `GET /api/v1/health`.

Set real random values for all secret variables and change the trainer seed password before running the seed. `pnpm db:seed` is explicit and idempotent; application startup never seeds data.

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

Use `feature/`, `fix/`, `chore/`, `docs/`, or `refactor/` prefixes followed by kebab-case. Each major domain—nutrition, programs, workouts, media, and admin—gets its own focused branch and pull request. See [CONTRIBUTING.md](CONTRIBUTING.md) for examples and the review checklist.

## Intentional deferrals

- Email verification
- OAuth and two-factor authentication
- Relational health-restriction records (currently validated JSON tags)
- Goal-history tracking (the profile stores the current goal)
- Nutrition target calculation
- Workout-program generation
