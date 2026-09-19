# ADR 002: Zod as the single request-validation strategy

- Status: Accepted
- Date: 2026-09-19

## Context

The API, web forms, and future mobile forms need the same runtime request rules. NestJS decorator validation would create API-only DTO definitions and encourage the clients to duplicate constraints.

## Decision

Use Zod for all request and form validation. Reusable schemas live in `@repo/validation`, with input types inferred from those schemas.

NestJS DTO adapter classes expose a static `schema` consumed by the global `ZodValidationPipe`. Domain checks requiring persistence or external state remain in services. Do not add `class-validator` or decorator-based request validation.

## Consequences

### Positive

- One runtime schema can be shared by API, web, and mobile.
- TypeScript input types derive from validation rather than drifting from it.
- Error responses use one consistent validation shape.
- Client forms reject invalid requests before network calls.

### Negative

- Swagger schemas require explicit integration because TypeScript and Zod metadata are not automatically Nest decorators.
- Database-dependent invariants cannot live entirely in shared schemas.
- DTO adapter classes still bridge Nest metadata to shared schemas.

## Alternatives considered

- `class-validator` DTO decorators: rejected because schemas cannot be reused directly by clients.
- Different validators per app: rejected because rules and error behavior would drift.
- Validation only in services: rejected because it weakens the HTTP boundary and client reuse.
