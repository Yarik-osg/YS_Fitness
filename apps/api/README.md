# API

NestJS REST API for YS Fitness. Local routes use the `/api/v1` prefix, with Swagger at `/api/v1/docs` and readiness at `/api/v1/health`.

Run commands from the repository root:

```bash
pnpm --filter api dev
pnpm --filter api test
pnpm --filter api test:e2e
```

Environment ownership is documented in [.env.example](.env.example). Domain structure and persistence rules are defined in the root [ARCHITECTURE.md](../../ARCHITECTURE.md) and [CONTRIBUTING.md](../../CONTRIBUTING.md).
