# Session: sponsorship module (allowance per student) - BE - 2026-07-09

## Context

- **Task ID:** - (module-scope session, feature-focused)
- **FDD Reference:** - (no FDD or task file provided; session grounded directly in the codebase)
- **Module:** sponsorship
- **Session Type:** Backend
- **Developer:** -

**Change request:** When creating a sponsorship, add an "Allowance per student" field beside
"Fund Allocation". Confirmed to be an entered input (the coordinator types it), not a derived value.

---

## Decisions Made

- **New entered input field `allowancePerStudent`** (monetary, per-student allowance) alongside
  `fundAllocation` on sponsorship create.
- **Column: `allowance_per_student Decimal?` (nullable).** `fund_allocation` is NOT NULL, but adding
  a NOT NULL Decimal to the client's existing `sponsorships` rows would need a default/backfill.
  Nullable column keeps the migration a single additive `ADD COLUMN`; legacy sponsorships stay NULL.
- **Required at the API layer.** The create validator requires `allowancePerStudent`
  (`isFloat({ min: 0.01 })`), mirroring `fundAllocation`. New sponsorships must provide it even
  though the column is DB-nullable for legacy rows.
- **Independent of fund allocation.** No cross-field consistency rule
  (`allowancePerStudent x slot == fundAllocation`). The two amounts are independent - allocation may
  include buffer/admin costs. Revisit only if the FDD says otherwise.
- **Applies to create and update.** The sponsorship body validator (`validateSponsorship`) is shared,
  so `allowancePerStudent` is validated on both create and update.
- **Response exposes it.** `SponsorshipResponse.allowancePerStudent` returns the stored value (or
  null for legacy sponsorships).

---

## Constraints Identified

- Sponsorship create fields today: `name, sponsorId, academicYearId, durationFrom/To, batchNumber,
  limit, slot, fundAllocation, sponsorshipSchool[], sponsorshipRequirements[]`
  (`types.ts:57-69`). `allowancePerStudent` is added next to `fundAllocation` in each layer.
- `fund_allocation` is a required `Decimal` with no default (`schema.prisma:373`); the new column is
  intentionally nullable to avoid a NOT-NULL-without-default failure on the populated client DB.
- `fundAllocation` validation is `isFloat({ min: 0.01 })` with no `optional()` - effectively required.
  `allowancePerStudent` mirrors this exactly.
- Message strings live in `utils/constant.ts` (VALIDATION_MESSAGES) - add
  `SPONSORSHIP_ALLOWANCE_PER_STUDENT_INVALID` (and REQUIRED if desired), do not inline.
- Decimal handling: Prisma returns `Decimal` objects; the converter passes `fund_allocation`
  straight through to the response as-is (`converter.ts:478`) - follow the same treatment so the
  response shape stays consistent.

---

## Touch Points (implementation checklist)

- `prisma/schema.prisma:373` area - add `allowance_per_student Decimal?` under `fund_allocation`.
- Migration: additive `ADD COLUMN allowance_per_student DECIMAL NULL` (no backfill, no default).
- `npx prisma migrate dev` + `npx prisma generate`.
- `middleware/validation.ts:707` - add
  `body("allowancePerStudent").isFloat({ min: 0.01 }).withMessage(SPONSORSHIP_ALLOWANCE_PER_STUDENT_INVALID)`
  next to the `fundAllocation` validator (in `validateSponsorship`).
- `utils/constant.ts:265` area - add `SPONSORSHIP_ALLOWANCE_PER_STUDENT_INVALID`.
- `utils/types.ts:66` - `SponsorshipRequest.allowancePerStudent: number`. `:99` -
  `SponsorshipResponse.allowancePerStudent: number` (nullable on read for legacy rows).
- `utils/converter.ts:379` - write `allowance_per_student: payload.allowancePerStudent`. `:478` -
  read `allowancePerStudent: payload.allowance_per_student`.
- `docs/swagger.yml:3900` and `:5027` - add `allowancePerStudent` to the sponsorship request +
  response schemas next to `fundAllocation`.
- Confirm whether `PublicSponsorshipResponse` and `docs/api/sponsorship/all-schools_api.yaml` should
  also surface the field (Open Question 2).

---

## Open Questions

| # | Question | Owner | Due |
|---|----------|-------|-----|
| 1 | Should the FE display `allowancePerStudent` as read-only on existing (legacy, NULL) sponsorships, or require a value on next edit? | dev / FE | TBD |
| 2 | Should `allowancePerStudent` also appear in the public sponsorship response / all-schools API, or only the coordinator-facing detail? | BA / PM | TBD |
| 3 | Confirm no consistency rule against `fundAllocation` / `slot` is expected by the FDD. | BA | TBD |

---

## Next Steps

- Proceed to sync-dev-tdd: `/sync-dev-tdd sponsorship @backend-tasks.md @fdd-sponsorship.md`
- Write the additive nullable-column migration; validator required at API layer.

---

## Risks

- **API contract addition:** create/update now expect `allowancePerStudent`. If the FE does not send
  it, create/update will 400. Coordinate the FE change with this release (Open Question 1).
- **Nullable vs required mismatch:** the column is DB-nullable but API-required, so legacy rows read
  back NULL. Any response consumer must tolerate a null `allowancePerStudent`.
- **Decimal precision:** `Decimal` with no explicit precision/scale uses the DB default; confirm the
  scale is adequate for currency (2 dp) if the client relies on exact money values.

---

## References

- `prisma/schema.prisma:362-393` - sponsorship model (`fund_allocation` at 373)
- `middleware/validation.ts:703-707` - sponsorship create validators (`fundAllocation` at 707)
- `utils/types.ts:57-107` - SponsorshipRequest / SponsorshipResponse
- `utils/converter.ts:379,478` - fund allocation mapping both directions
- `utils/constant.ts:256,265` - fund allocation messages
- `docs/sessions/be/sponsorship-all-schools-2026-06-25.md` - prior sponsorship session
