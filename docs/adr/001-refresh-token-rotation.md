# ADR 001: Refresh-token rotation with family-based reuse detection

- Status: Accepted
- Date: 2026-09-19

## Context

The web and future mobile app need long-lived sessions without making access JWTs long-lived. A single refresh-token hash on the user cannot support independent devices, reliable rotation, or detection of an older token being replayed.

## Decision

Each login creates an `AuthSession`. Every refresh JWT has a token identifier and a corresponding `AuthRefreshToken` record containing only a SHA-256 digest, expiry, consumption, and revocation state.

Refreshing is transactional: consume the presented token once and create its replacement. If a consumed token is presented again, revoke the entire session and every token in that family.

Access JWTs remain short-lived and contain only `sub`, `sessionId`, `role`, `iat`, and `exp`. Browser refresh tokens use protected cookies; native refresh tokens are returned for secure device storage.

## Consequences

### Positive

- Supports independent web/mobile/device sessions.
- Detects replay instead of treating every old token as an unexplained invalid token.
- Logout or replay can invalidate access immediately through session validation.
- Stored refresh credentials are not usable if the database is exposed.

### Negative

- Refresh history grows and eventually needs retention cleanup.
- Refresh operations require a serializable transaction.
- Every access-token validation performs a session lookup.
- Client transport and CSRF rules differ between browser and native clients.

## Alternatives considered

- One refresh hash on `users`: rejected because it breaks multi-device sessions.
- Current hash only on `auth_sessions`: rejected because older-token replay cannot be distinguished from random invalid input.
- Stateless refresh JWTs: rejected because rotation, logout, and replay revocation would be unreliable.
