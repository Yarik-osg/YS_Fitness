# ADR 003: One onboarding question for program track and BMR calculation sex

- Status: Accepted
- Date: 2026-09-20
- Decision owners: Product / web

## Context

Onboarding previously asked two questions that look similar to users:

1. Program track (`Для жінок` / `Для чоловіків`) — client-only UX branch for images, copy, and accents.
2. `biologicalSexForCalculation` (`MALE` / `FEMALE`) — persisted profile input for the Mifflin–St Jeor BMR formula.

They were kept separate for semantic accuracy: a visual/program preference is not guaranteed to match the sex used in calorie math. That extra step added friction. There is still no profile-edit flow that can change calculation sex independently of program track.

## Decision

Merge them into a single “Обери свій напрямок” step. Selecting female or male writes both `draft.programTrack` and `draft.biologicalSexForCalculation` (`female` → `FEMALE`, `male` → `MALE`).

The PUT `/users/me/onboarding` contract is unchanged: the payload still sends `biologicalSexForCalculation` and still omits `programTrack`.

This reverses the earlier product/architecture choice to keep the two questions separate.

## Consequences

### Positive

- One fewer onboarding screen.
- Calorie-calculation input is collected without a second, overlapping question.

### Negative

- A user whose UX preference differs from their BMR-relevant sex is not asked separately during onboarding.
- Correcting `biologicalSexForCalculation` independently of `programTrack` requires a future profile-edit flow. That flow does not exist yet, so today this is a one-time onboarding-only input.
- Until nutrition exists, a mismatch would show up as a wrong calorie/macro target that the user would have to fix later.

## Alternatives considered

- Keep two steps for semantic accuracy: rejected because the overlap cost more friction than it saved for the expected user.
- Persist `programTrack` on the profile: rejected; it remains a client-draft/UX field until a programs contract exists.

## References

- [ARCHITECTURE.md](../../ARCHITECTURE.md) domain boundaries
- [apps/web/README.md](../../apps/web/README.md) onboarding persistence
