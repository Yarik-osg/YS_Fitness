# Contributing

## Before starting

Read [ARCHITECTURE.md](ARCHITECTURE.md) and the accepted decisions in [docs/adr](docs/adr). Keep changes focused: nutrition, programs, workouts, media, and admin should each be developed in separate feature branches and pull requests.

## Branches and commits

Branch names use lowercase kebab-case:

- `feature/nutrition-targets`
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
4. Repositories isolate substantial Prisma queries and persistence mapping. A small module may keep simple Prisma access in its service until a repository improves clarity or testing.
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

The web app uses route groups for layouts and `features/` for product logic:

```text
apps/web/
├── app/
│   ├── (marketing)/
│   ├── (auth)/
│   ├── (client)/
│   ├── (trainer)/
│   └── layout.tsx
├── components/
│   ├── layout/
│   └── ui/
├── features/
│   └── onboarding/
│       ├── actions/
│       ├── components/
│       └── hooks/
├── lib/
│   ├── api/
│   ├── auth/
│   └── env.ts
└── types/
```

Rules:

1. `app/` files define routes, layouts, loading/error states, and composition—not domain logic.
2. Server Actions live under `features/<domain>/actions/` and use `server-only` infrastructure.
3. Client components include `"use client"` only at the smallest interactive boundary.
4. API clients and API-calling utilities live in `lib/api/`; feature-specific TanStack Query hooks live under the feature's `hooks/`.
5. Use `@repo/validation` for form/request schemas and `@repo/shared-types` for API responses. Do not recreate contracts in the web app.
6. Web-only view models and navigation types belong in `apps/web/types`.
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
- Whether web tests standardize on Vitest/Testing Library, Playwright, or both.
- Whether every API module must have a repository or only query-heavy modules.
- When `packages/ui` becomes a formal design system with visual documentation.
