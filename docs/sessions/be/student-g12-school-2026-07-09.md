# Session: student module (G12 school) - BE - 2026-07-09

## Context

- **Task ID:** - (module-scope session, feature-focused)
- **FDD Reference:** - (no FDD or task file provided; session grounded directly in the codebase)
- **Module:** student
- **Session Type:** Backend
- **Developer:** -

**Change request:** The Grade 12 school of a student applicant must be a free-text value typed
by the student, not a dropdown selection from the `school` table. Scope is G12 only - the college
school remains an FK-backed dropdown.

---

## Decisions Made

- **G12 school becomes free text.** Add `g12_school_name String? @db.VarChar(255)`. The student
  types the school name; there is NO existence check against the `school` table.
- **Request field rename:** request now carries `g12SchoolName` (free text) instead of
  `g12SchoolId` (UUID). This is a breaking request-contract change for the front end.
- **Response:** `g12SchoolName` is now sourced from the new `g12_school_name` column instead of
  the `g12_school` relation. `g12SchoolId` is removed from the response (no longer meaningful).
- **Validation:** replace the `g12SchoolId` validator (which used `checkSchoolExist`) with an
  optional `g12SchoolName` string validator. No DB lookup. New constant
  `G12_SCHOOL_NAME_INVALID`.
- **Non-destructive schema change.** Add the new column only. Keep `g12_school_id`, the
  `g12_school` relation, and its reverse relation on the `school` model untouched in the schema so
  the migration is a single additive `ADD COLUMN` - no FK-constraint drop, no relation surgery. A
  later cleanup migration drops the FK + column once confirmed safe.
- **Backfill existing data.** Because the database is live, the migration includes a one-time
  `UPDATE students SET g12_school_name = (school_name of the referenced g12_school)` so existing
  applicants keep their displayed school.
- **Scope is G12 only.** `college_school_id` and the `college_school` relation stay exactly as they
  are (FK dropdown). The `school` module and its endpoints are untouched.

---

## Constraints Identified

- G12 school today is a `Binary(16)` FK (`g12_school_id`) with a Prisma relation `g12_school`
  (`schema.prisma:146,202`) and a server-side existence check in validation
  (`validation.ts:360-367`) - all of which must stop driving G12 behavior.
- The response type already exposes `g12SchoolName` (`types.ts:411`), so switching its source from
  the relation to the new column is NOT a breaking read change for that field - only the removal of
  `g12SchoolId` from the response is.
- Repository currently eager-loads `g12_school` (`repository.ts:152,223`); once the name lives on a
  column this include is unnecessary and should be removed for the G12 path.
- Repo precedent for non-destructive deprecation: `mother_maiden_extension` uses `@ignore`
  (`schema.prisma:165-167`) to retain-but-hide a column. Same philosophy applies to the eventual
  `g12_school_id` cleanup.
- All message strings live in `utils/constant.ts` (VALIDATION_MESSAGES) - do not inline.

---

## Touch Points (implementation checklist)

- `prisma/schema.prisma:146` area - add `g12_school_name String? @db.VarChar(255)`; leave
  `g12_school_id` + `g12_school` relation (and the reverse on `school`) untouched.
- Migration: additive `ADD COLUMN g12_school_name VARCHAR(255) NULL` + backfill UPDATE from the
  related `school.school_name`.
- `npx prisma migrate dev` + `npx prisma generate`.
- `middleware/validation.ts:360-367` - replace the `g12SchoolId` + `checkSchoolExist` validator
  with `body('g12SchoolName').optional(...).isString().withMessage(G12_SCHOOL_NAME_INVALID)`.
- `utils/constant.ts:172-173` - add `G12_SCHOOL_NAME_INVALID`; `G12_SCHOOL_ID_*` become unused
  (leave or remove).
- `utils/types.ts:290` - request: `g12SchoolId?` -> `g12SchoolName?`. `:410-411` - response: remove
  `g12SchoolId?`, keep `g12SchoolName?`.
- `utils/converter.ts:65` - write: drop `g12_school_id` mapping, add
  `g12_school_name: response.g12SchoolName`. `:233-234` - read: `g12SchoolName: item.g12_school_name`,
  remove `g12SchoolId`.
- `student/repository.ts:152,223` - remove the `g12_school` include (G12 name now comes from the column).
- `docs/swagger.yml` - update the create/update student request + detail schema: `g12SchoolId`
  -> `g12SchoolName` (free text, no enum, no UUID).

---

## Open Questions

| # | Question | Owner | Due |
|---|----------|-------|-----|
| 1 | Confirm FE will send `g12SchoolName` (free text) and stop sending/reading `g12SchoolId` before release. | dev / FE | TBD |
| 2 | Should the later cleanup migration drop `g12_school_id` + the `g12_school` relation, or keep the column via `@ignore` like `mother_maiden_extension`? | dev / BA | TBD |
| 3 | Any max length / trimming rule for the typed school name beyond VARCHAR(255)? | BA / PM | TBD |

---

## Next Steps

- Proceed to sync-dev-tdd: `/sync-dev-tdd student @backend-tasks.md @fdd-student.md`
- Write the additive migration + backfill first; schedule the FK/column drop as a separate follow-up.

---

## Risks

- **Breaking request contract:** the create/update endpoints now expect `g12SchoolName` instead of
  `g12SchoolId`. Any FE still posting a UUID will have it ignored (or mis-stored). Coordinate via
  Open Question 1 before release.
- **Silent orphan FK:** keeping `g12_school_id` while no longer writing it means the column drifts
  stale. Acceptable short term; the cleanup migration must eventually remove it.
- **Backfill correctness:** if any `g12_school_id` points to a deleted/soft-deleted school, the
  backfill yields NULL for that row - acceptable, but verify against the `school.record_status`
  convention before running.

---

## References

- `prisma/schema.prisma:146,202-203` - G12 FK column + relation (and college relation kept as-is)
- `middleware/validation.ts:360-367` - current `g12SchoolId` existence-check validator
- `utils/converter.ts:65,233-234` - G12 school mapping both directions
- `utils/types.ts:290,410-411` - request/response G12 school fields
- `student/repository.ts:152,223` - `g12_school` eager-load include
- `docs/sessions/be/student-2026-07-09.md` - prior session; same non-destructive column pattern
