# Contributing

## Before starting

Read [ARCHITECTURE.md](ARCHITECTURE.md) and the accepted decisions in [docs/adr](docs/adr). Keep changes focused: subscriptions, nutrition, programs, workouts, media, and admin should each be developed in separate feature branches and pull requests.

## Branches and commits

Branch names use lowercase kebab-case:

- `feature/nutrition-targets`
- `feature/subscriptions-mock-provider`
- `fix/refresh-token-race`
- `chore/update-tooling`
- `docs/program-boundaries`
- `refactor/workout-repository`

Use Conventional Commits, for example:

```text
feat(api): add nutrition target calculation
fix(auth): revoke replayed token family
docs: record program generation boundary
```

Keep commits reviewable. Do not mix unrelated domain modules into one branch.

## NestJS domain modules

New API domains follow this shape:

```text
apps/api/src/nutrition/
├── dto/
│   ├── calculate-target.dto.ts
│   └── update-target.dto.ts
├── nutrition.controller.ts
├── nutrition.service.ts
├── nutrition.repository.ts
├── nutrition.service.spec.ts
└── nutrition.module.ts
```

Rules:

1. Controllers translate HTTP input/output and call services; they do not inject Prisma.
2. DTO adapter classes reference schemas from `@repo/validation` through a static `schema` property for the global Zod pipe.
3. Services own domain rules and transactions.
4. Repositories isolate nontrivial Prisma queries and persistence mapping. New modules must use a repository for multi-step, complex, or query-heavy persistence; a simple single-record read/write may stay in the service when that is clearer.
5. Public response types come from `@repo/shared-types`. Prisma types never leave `apps/api`.
6. Unit tests are colocated as `*.spec.ts`; PostgreSQL-backed flows live in `apps/api/test/*.e2e-spec.ts`.
7. A module writes only its own tables. Cross-domain work goes through an exported service or explicit contract.

Example DTO adapter:

```typescript
import {
  calculateNutritionSchema,
  type CalculateNutritionInput,
} from '@repo/validation';

export class CalculateNutritionDto implements CalculateNutritionInput {
  static readonly schema = calculateNutritionSchema;
}
```

## Next.js App Router

The web app uses locale-prefixed routes and keeps product UI in `components/features/`:

```text
apps/web/
├── app/
│   └── [locale]/
│       ├── (marketing)/
│       ├── (auth)/
│       ├── (client)/
│       └── (password)/
├── components/
│   ├── features/
│   ├── layout/
│   └── ui/
└── lib/
    ├── api/
    │   └── client.ts
    ├── auth/
    └── hooks/
```

Rules:

1. `app/` files define routes, layouts, loading/error states, and composition—not domain logic.
2. Keep product components in `components/features/<domain>/`; do not introduce a parallel `features/<domain>/actions/` tree unless a concrete Server Action use case requires it.
3. Client components include `"use client"` only at the smallest interactive boundary.
4. The API client and API-calling utilities live in `lib/api/`; API hooks live in `lib/hooks/`.
5. Use `@repo/validation` for form/request schemas and `@repo/shared-types` for API responses. Do not recreate contracts in the web app.
6. Keep types close to the code that owns them; use shared API contracts from `@repo/shared-types` rather than creating a parallel root `types/` directory.
7. Promote a component to shared `components/` or `@repo/ui` only after it is reused.

## Environment variables

Each app owns its `.env.example`. Never commit `.env` files or real credentials.

- `apps/api/.env.example` contains server/database/auth settings.
- `apps/web/.env.example` contains browser-safe public URLs.

Only variables prefixed with `NEXT_PUBLIC_` may be exposed to browser bundles. API runtime variables are parsed by the typed config boundary before startup.

## Local quality checks

```bash
pnpm format:check
pnpm lint
pnpm check-types
pnpm test
pnpm build
```

Git hooks format/lint staged files, type-check affected packages, enforce commit messages, and test affected packages before push. Hooks supplement CI; they do not replace it.

## Pull requests

- Explain the user-visible or architectural outcome.
- Add tests for changed behavior.
- Include a migration whenever `schema.prisma` changes.
- Update README/ARCHITECTURE/ADRs when boundaries change.
- Verify no secrets or local environment files are included.

## Open conventions before additional domains

These decisions remain intentionally open and should be resolved when the relevant work begins:

- Whether to rename workspace packages from `@repo/*` to `@ys-fitness/*`.
- When `packages/ui` becomes a formal design system with visual documentation.
