# API

NestJS REST API for YS Fitness. Local routes use the `/api/v1` prefix, with Swagger at `/api/v1/docs` and readiness at `/api/v1/health`.

Run commands from the repository root:

```bash
pnpm --filter api dev
pnpm --filter api test
pnpm test:e2e
```

`pnpm test:e2e` runs from the repository root. `pnpm --filter api test:e2e` checks the same URL, then starts Vitest. `TEST_DATABASE_URL` must be a migrated database URL. If `apps/api/.env` defines `DATABASE_URL`, that database name is refused.

Environment ownership is documented in [.env.example](.env.example). Domain structure and persistence rules are defined in the root [ARCHITECTURE.md](../../ARCHITECTURE.md) and [CONTRIBUTING.md](../../CONTRIBUTING.md).
