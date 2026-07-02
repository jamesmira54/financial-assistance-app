# Session: sponsorship (All Schools) - BE - 2026-06-25

## Context

- **Task ID:** - (module-scope)
- **FDD Reference:** - (no FDD/task file; codebase + client comment used as source of truth)
- **Module:** sponsorship
- **Session Type:** Backend
- **Developer:** -

Client comment: "Coordinator can choose All Schools for creating scholarship sponsor."
Chosen representation: an empty (or omitted) `sponsorshipSchool` list means the sponsorship
applies to ALL schools. No schema change; coverage is dynamic (current and future schools).

---

## Decisions Made

- "All schools" is represented by an EMPTY or OMITTED `sponsorshipSchool` array. No new schema
  column / no migration. Chosen over a boolean flag and over materializing all school IDs, because
  it is dynamic (auto-covers schools added later) and reuses the existing join structure.
- Validation (`validateSponsorship`, `middleware/validation.ts`): relax `sponsorshipSchool` from
  `.isArray({ min: 1 })` to `.optional({ nullable: true }).isArray()`. Accept BOTH an empty array
  `[]` and an omitted/null field as "all schools." When a NON-empty array is given, keep the
  existing checks (each item a non-empty string + `checkIfInvalidSchoolId`). Short-circuit
  `length === 0` to valid BEFORE any DB call.
- Eligibility (`getAllAvailableSponsorship`, `sponsorship/service.ts`): drop the early
  `return []` when the student has no `college_school_id`. Build the filter as:
  `OR: [{ schools: { none: {} } }, (student has school ? { schools: { some: { school_id } } } : skip)]`
  with `record_status: ACTIVE`.
- All-schools (no-school) sponsorships are visible to EVERY student, including students with no
  `college_school_id` set. (Overrides the initial recommendation to keep the early return.)
  Students WITH a school see all-schools sponsorships PLUS their own school's.
- Create and update already write zero join rows when the list is empty
  (`if (payload.sponsorshipSchool?.length)`), and update deletes all join rows first - so editing
  a sponsorship down to empty correctly flips it to "all schools." No change needed there.
- API response: an all-schools sponsorship returns an EMPTY `schools` array. No explicit
  `allSchools` boolean is added to the response for now; the frontend infers "All Schools" from the
  empty array. (See Open Questions.)

---

## Constraints Identified

- `validateSponsorship` is shared by BOTH create (`POST /sponsorships/coordinator`) and update
  (`PUT /sponsorships/coordinator/:sponsorshipId`); both are gated by
  `allowRoles('system admin', 'financial assistance coordinator')`. So the relaxed validation
  applies to both, and only coordinators/admins can set it (RBAC already satisfied).
- `getAllAvailableSponsorship` is the ONLY query that filters visibility by school. The other
  `schools:` references in `sponsorship/repository.ts` (lines ~252, 310, 357) are `include` for
  display, not filters. Public listing (`getAllPublicSponsorship`) has no school filter.
- `checkIfInvalidSchoolIdRepo([])` returns `false` (treated as valid) because
  `count(0) !== length(0)` is false - but the validator will short-circuit empty before calling it.
- Safe to overload "empty = all": current validation FORBIDS an empty list, so no existing
  sponsorship has zero schools meaning anything else. No data migration / cleanup required.

---

## Open Questions

| # | Question | Owner | Due |
|---|----------|-------|-----|
| 1 | Add an explicit `allSchools: boolean` to the sponsorship response for UI clarity, or keep inferring from an empty `schools` array? Defaulted to infer; revisit if FE prefers a flag. | dev / FE | TBD |
| 2 | Should the FE send `[]`, omit the field, or expose an explicit "All Schools" toggle? Backend accepts all; FE to confirm UX. | FE | TBD |

---

## Next Steps

- Proceed to TDD for the sponsorship module (validation relaxation + eligibility OR clause).
- Tests: (a) validator chain accepts empty and omitted `sponsorshipSchool` with no school error,
  still rejects bad IDs when non-empty; (b) `getAllAvailableSponsorship` builds a where with the
  `OR`/`none` clause - all-schools sponsorships returned for a student with no school, and for a
  student with a school in addition to their matched ones.

---

## Risks

- Removing the early `return []` broadens visibility for school-less students (intended per
  decision, but flag to QA - confirm no student is unexpectedly shown sponsorships).
- Frontend MUST interpret an empty `schools` array as "All Schools" and send `[]`/omit accordingly.
  Mismatch would let a coordinator unintentionally create an all-schools sponsorship. Coordinate the
  contract with FE.
- The eligibility query change must be verified against pagination/filtering in
  `getAllSponsorshipRepo` (the `OR` is ANDed with other params).

---

## References

- `middleware/validation.ts:747-759` - `sponsorshipSchool` validator (target of relaxation)
- `sponsorship/service.ts:421-445` - `getAllAvailableSponsorship` (eligibility filter)
- `sponsorship/service.ts:185-192`, `339-347` - create/update school join handling (compatible)
- `sponsorship/controller.ts:14,26` - create/update routes (shared validator + RBAC)
- `school/repository.ts:148-156` - `checkIfInvalidSchoolIdRepo` (empty-array behavior)
