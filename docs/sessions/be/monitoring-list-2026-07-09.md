# Session: monitoring-list - BE - 2026-07-09

## Context

- **Task ID:** - (module-scope session; no Task ID or task file exists)
- **FDD Reference:** none - no formal FDD exists. Grounded against the pasted "Monitoring List" spec (treated as mini-FDD) and `prisma/schema.prisma`.
- **Module:** monitoring-list (new backend module; grantee monitoring / reporting)
- **Session Type:** Backend
- **Developer:** dinosaur9157643

---

## Decisions Made

- **Grantee lifecycle status extends the existing `application_status` enum.** Add `ACTIVE`, `DELISTED`, `GRADUATED` to `application_status` (not a new field, not a separate table). Migration + `prisma generate` required.
- **"Grant (TDP/TES)" type is derived from `sponsorship.name`.** No new `grant_type` field; the scholarship name carries the TDP/TES distinction.
- **A "grantee" = any `sponsorshipApplication` that reached award or beyond**, i.e. `application_status IN (AWARDED, ACTIVE, DELISTED, GRADUATED)`. This is the base set the Monitoring List queries. (See Open Questions #1 - confirm whether `AWARDED` counts as a grantee row before promotion to `ACTIVE`.)
- **Type filter mapping:** All Grantees = full base set; Active = `ACTIVE`; Delisted = `DELISTED`; Graduated = `GRADUATED`.
- **Export is backend-generated for both formats.** Add `exceljs` (Excel) and a PDF lib (`pdfkit` or `pdfmake`) as new dependencies; endpoints stream the file with `Content-Disposition: attachment`. No export library or export endpoint exists in the repo today - this is net-new scope.
- **RBAC:** `System Admin` and `Financial Assistance Coordinator` see all grantees; `Sponsor` sees only grantees under their own sponsorships (scoped by `sponsorship.sponsor_id`); `Student` has no access. Enforced with `allowRoles(...)` at the route and sponsor-scoping applied at the service layer.
- **Award Number links to the student profile** (spec: "Student Award Number can be viewed directly to profile") - the list row exposes the student id so the frontend can deep-link.

## Field/Column Mapping (confirmed against schema)

| Spec field | Schema source |
|---|---|
| Name of Scholarship / Grant (TDP/TES) | `sponsorship.name` |
| Academic Year (filter) | `sponsorship.academic_year_id` -> `academicYear.academic_year_start`/`academic_year_end` |
| Award Number | `sponsorshipApplication.award_number` |
| Batch | `sponsorship.batch_number` |
| Semester | `academicYear.school_term` |
| Complete Name | `student.first_name` / `middle_name` / `last_name` / `extension_name` |
| Gender | `student.sex` |
| Year Level | `student.college_year_level` |
| Course | `student.college_program_name` |
| School | `student.college_school_id` -> `school.name` |
| GWA | `student.gwa` |
| Status | `sponsorshipApplication.application_status` (new ACTIVE/DELISTED/GRADUATED values) |
| Seq | derived row number (offset + index), not persisted |

---

## Constraints Identified

- All PKs are `Binary(16)` UUIDs - every UUID crossing the DB boundary must go through `uuidToBinary` / `binaryToUuid` (per CLAUDE.md). Sponsor scoping and any id filters must convert.
- Responses must go through `ResponseHandler`; validators live in `middleware/validation.ts`; message strings in `utils/constant.ts` (no inline strings). New status enum values and any new messages go there.
- `application_status` is a shared workflow enum (POOLING -> FINAS_PROPER). Adding post-award values means every place that switches on `application_status` (ranking, stage transitions) must ignore/skip the new values so they don't leak into the application workflow.
- `student.sex` is a nullable `VarChar(10)` free-text-ish column, not an enum - the Gender column may contain inconsistent values; render as-is.
- `academicYear.school_term` is an `Int` - the Semester column needs a display mapping (e.g. 1 -> "1st Sem") on read.
- Sex/GWA/year level/course/school are all nullable on `student` - the list must tolerate nulls in every column.

---

## Open Questions

| # | Question | Owner | Due |
|---|----------|-------|-----|
| 1 | Does `AWARDED` (freshly selected, pre-enrollment) appear in the Monitoring List, or only after promotion to `ACTIVE`? Spec defines Active as "enrolled + receiving stipends", implying an `AWARDED` -> `ACTIVE` step. | BA / PM | TBD |
| 2 | What triggers `AWARDED` -> `ACTIVE`, `-> DELISTED`, `-> GRADUATED`? Is there a mutation endpoint / UI for coordinators to change grantee status, or is it out of scope for this list? | BA / PM | TBD |
| 3 | Delisting reasons ("dropped grades, structural violations, voluntary exit") - captured anywhere, or is status-only enough? Extending the enum stores no reason/date; a separate table would. | BA / PM | TBD |
| 4 | PDF library choice: `pdfkit` (imperative) vs `pdfmake` (declarative doc-definition). Confirm before install. | Dev | TBD |
| 5 | Does the Academic Year filter target the sponsorship's academic year, and how is it presented (id vs "2025-2026" label)? | Dev / BA | TBD |

---

## Next Steps

- Write the Prisma migration adding `ACTIVE`, `DELISTED`, `GRADUATED` to `application_status`; run `npx prisma migrate dev` + `npx prisma generate`.
- Audit existing `application_status` switch/where usages so post-award values don't corrupt the POOLING->FINAS_PROPER workflow.
- Scaffold `monitoring-list/` module (controller / service / repository) and mount under `/api/v1` in `routes.ts`.
- Add `exceljs` + chosen PDF lib to `package.json`.
- Proceed to `/sync-dev-tdd` for the list endpoint (query + filters + RBAC scoping) first, then the export endpoints.

---

## Risks

- **Enum overloading (highest risk):** post-award statuses sharing `application_status` with the application workflow can leak into ranking/selection logic if any query does not explicitly exclude them. Mitigate with an audit + explicit `IN`/`NOT IN` filters and tests.
- **No export infrastructure exists:** Excel + PDF generation is entirely new (new deps, streaming, formatting). Larger effort than the list query itself; PDF layout of a 12-column wide table is fiddly.
- **No formal FDD:** decisions here derive from a thin pasted spec. Open Questions #1-#3 are genuine product gaps (status transitions, delisting reasons) that could force a schema change to a separate `grantee` table later - the enum approach does not store transition dates or reasons.
- **Sponsor scoping correctness:** the Sponsor "own grantees only" filter is a data-isolation boundary; a missed join condition leaks cross-sponsor grantee data. Needs an explicit test.

---

## References

- `prisma/schema.prisma` - `student` (96-208), `sponsorshipApplication` (438-460), `sponsorship` (362-396), `academicYear` (398-414), `application_status` enum (608-625)
- `CLAUDE.md` - UUID binary helpers, ResponseHandler, RBAC (`allowRoles`), validation conventions
- Pasted "Monitoring List" spec (2026-07-09) - source requirements, treated as mini-FDD
