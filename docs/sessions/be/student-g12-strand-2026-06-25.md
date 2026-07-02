# Session: student-module (g12AcademicStrand) - BE - 2026-06-25

## Context

- **Task ID:** - (module-scope)
- **FDD Reference:** - (no FDD/task file; codebase used as source of truth)
- **Module:** student
- **Session Type:** Backend
- **Developer:** -

Scope: predefine the allowed values for `g12AcademicStrand` on student create/update.
Currently the field is free-form (`isString()`), accepting any string up to 255 chars.

---

## Decisions Made

- Restrict `g12AcademicStrand` to exactly five values: `ABM`, `STEM`, `HUMSS`, `GAS`, `TVL`.
- Enforce via `express-validator` `.isIn([...])`, mirroring the existing `sex` validator at `middleware/validation.ts:177`.
- Matching is case-sensitive / exact uppercase (same behavior as `sex`). Frontend must send exact casing; no input normalization sanitizer.
- App-level validation only. No Prisma `enum`, no migration. `g12_academic_strand` stays `String? @db.VarChar(255)`.
- No fallback / `Other` option. Field remains optional (`optional({ nullable: true, checkFalsy: true })`), so "no strand" is expressed by omitting the field.
- Allowed values live in a shared constant array in `utils/constant.ts` (single source of truth), referenced by the validator.
- Update the existing message `G12_ACADEMIC_STRAND_REQUIRED` (or add a dedicated `G12_ACADEMIC_STRAND_INVALID`) to read like the `sex` message: "G12 academic strand must be one of: ABM, STEM, HUMSS, GAS, TVL".

---

## Constraints Identified

- `commonValidationMiddleware` (`middleware/validation.ts:173`) is shared, so the new rule applies to BOTH student create and update with a single change.
- The field is optional and remains so; validation must only trigger when a value is present (`optional({ checkFalsy: true })` already handles empty/null).
- Existing DB rows may hold out-of-set or arbitrary strand values. App-level validation does NOT retroactively constrain them; only new writes are checked. This is accepted (no data cleanup in scope).
- Swagger docs reference the strand field (`docs/swagger.yml` ~line 4261 `grade12Strand`) - update the schema description/enum there for accuracy.

---

## Open Questions

| # | Question | Owner | Due |
|---|----------|-------|-----|
| 1 | Should the allowed-strand list be exposed via an API endpoint for the frontend dropdown, or hardcoded on the client? | dev / FE | TBD |
| 2 | Is data cleanup of existing out-of-set strand values needed later? (out of scope now) | PM | TBD |

---

## Next Steps

- Add `ACADEMIC_STRANDS = ['ABM', 'STEM', 'HUMSS', 'GAS', 'TVL']` constant to `utils/constant.ts`.
- Update message constant to an "invalid" wording listing the allowed values.
- Change `middleware/validation.ts:191` from `.isString()` to `.isIn(ACADEMIC_STRANDS)`.
- Update `docs/swagger.yml` strand field with the enum.
- Proceed to TDD.

---

## Risks

- Case-sensitivity is a known friction point: if the frontend currently sends lowercase or mixed-case strands, those requests will start failing once `.isIn()` is enforced. Confirm the frontend payload casing before/with rollout.
- Any in-flight or seeded data with non-conforming strands will fail on the next update of that record (since update shares the same validator). Acceptable per decision, but flag to QA.

---

## References

- `middleware/validation.ts:177` - `sex` validator (pattern being mirrored)
- `middleware/validation.ts:191` - current `g12AcademicStrand` validator (target of change)
- `utils/constant.ts:122,146` - `SEX_INVALID` / `G12_ACADEMIC_STRAND_REQUIRED` messages
- `prisma/schema.prisma:138` - `g12_academic_strand String? @db.VarChar(255)` (unchanged)
