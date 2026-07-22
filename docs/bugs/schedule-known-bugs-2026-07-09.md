# Schedule module - known bugs (2026-07-09)

Two bugs found while reading the existing `schedule` CRUD during the Interview Schedule Management
dev session. Tracked here in markdown (not GitHub) per team decision.

---

## Bug 1 - by-id endpoints receive an undefined scheduleId (FIXED)

**Status:** FIXED in the schedule sync-dev-tdd pass (2026-07-09). All three handlers now use
`const { scheduleId } = req.params;`. Covered by a regression test:
`schedule/schedule.test.ts` -> "GET /api/v1/schedules/:scheduleId passes the URL id through to the service".

**Severity:** High - update, get-one, and delete do not work.

**Location:** `schedule/controller.ts:27, 50, 60`

```ts
const { scheduleId } = req.params.scheduleId;
```

`req.params.scheduleId` is a string. Destructuring `.scheduleId` off a string yields `undefined`,
so the id passed into `edit` / `fetch` / `remove` is `undefined`, and the repository then calls
`uuidToBinary(undefined)`.

**Affected endpoints:**
- PUT `/api/v1/schedules/:scheduleId` (update)
- GET `/api/v1/schedules/:scheduleId` (get one)
- DELETE `/api/v1/schedules/:scheduleId` (delete)

POST (create) and GET `/` (list) are unaffected because they do not read `scheduleId`.
`validateScheduleId` reads the param correctly, so validation passes and the handler breaks after.

**Fix:**

```ts
const { scheduleId } = req.params;        // or: const scheduleId = req.params.scheduleId;
```

Apply to all three handlers.

---

## Bug 2 - list search throws on non-string columns (FIXED)

**Status:** FIXED (2026-07-09). Search now uses `contains` only on string columns
(`location`, `batch_code`, `proctor_interviewer`) and typed equality for numeric/enum columns
(`batch_no`, `schedule_quota`, `schedule_type`, `examination_type`) only when the search term is
that type. Verified against real Prisma via live smoke test (`GET /api/v1/schedules?search=...`),
since the shared Prisma mock does not validate the `where` clause and cannot catch this class of bug.

**Severity:** Medium - list works without search, but any `?search=` value breaks the endpoint.

**Location:** `schedule/repository.ts:47-56` (the `all` function)

```ts
if (params.search && params.search !== "") {
  whereCondition.OR = [
    { batch_no:       { contains: params.search } },  // Int      - invalid
    { location:       { contains: params.search } },  // String   - OK
    { schedule_type:  { contains: params.search } },  // enum     - invalid
    { schedule_quota: { contains: params.search } },  // Int      - invalid
    { start_date:     { contains: params.search } },  // DateTime - invalid
    { end_date:       { contains: params.search } },  // DateTime - invalid
  ];
}
```

`contains` is a string-only operator. Only `location` is a valid target; the `Int`, enum, and
`DateTime` branches make Prisma reject the query as soon as `search` has a value.

**Impact:** `GET /api/v1/schedules?search=<value>` fails - search is effectively unusable.

**Expected:** Searching by a text value should match at least `location` without throwing.

**Suggested fix (assignee to decide):**
- Restrict the `OR` to string columns (`location`), OR
- Parse `params.search` and add typed equality branches only when it parses to the right type
  (`Number(search)` for `batch_no` / `schedule_quota`, a valid date for `start_date` / `end_date`),
  and drop `contains` on non-string columns.

---

## Bug 3 - endDate validator rejects all valid dates (FIXED)

**Status:** FIXED (2026-07-09). Discovered during live e2e smoke testing - schedule create/update
returned 400 `endDate: Invalid value` for every valid payload, which is why the `schedule` table
had 0 rows (creation never worked).

**Severity:** High - blocked all schedule create and update.

**Location:** `middleware/validation.ts` - the `endDate` custom validator in `validateSchedulePayload`.

**Cause:** the sync custom validator returned `undefined` on the happy path instead of `true`.
express-validator treats a `undefined`/falsy return from a synchronous custom validator as invalid,
producing the generic "Invalid value" message. (Other sync customs in this codebase, e.g. `gwa`,
correctly `return true`.)

**Fix:** add `return true;` after the two rejection branches.

**Covered by:** `schedule/schedule.test.ts` -> "accepts a valid endDate that is after startDate"
and verified live (POST/PUT `/schedules` now return 201/200).

## References

- Session: `docs/sessions/be/schedule-2026-07-09.md`
- `schedule/controller.ts`, `schedule/repository.ts`
