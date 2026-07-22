# Rollout - Student G12 School (free text) and Single Emergency Contact

Runbook for deploying the student-module changes made in the 2026-07-09 sessions to a populated
(client) database. Covers three migrations that must be applied in order:

1. `20260708202802_add_emergency_contact_relationship` - additive column.
2. `20260708204210_make_g12_school_free_text` - additive `g12_school_name` column + backfill from
   the referenced school's name.
3. `20260708205129_drop_g12_school_id` - destructive cleanup: drops the `g12_school_id` FK column.

`prisma migrate deploy` applies pending migrations in timestamp order, so the backfill always runs
before the drop. Names are preserved, then the old id column is removed.

## What changes for the client

- Emergency contact: a student now has ONE emergency contact plus a free-text
  `emergencyContactRelationship`. The second contact (`emergencyContactName2` / `Number2`) is
  removed from the API. DB columns for the second contact are retained (not dropped here).
- G12 school: now a free-text `g12SchoolName` typed by the student. No dropdown, no existence
  check. The `g12_school_id` FK column is dropped by migration 3.
- College school is unchanged (still an FK-backed selection).

## Breaking API contract (coordinate with frontend BEFORE deploy)

The frontend must be updated in the same release window:

- Send `g12SchoolName` (string) instead of `g12SchoolId` (UUID).
- Send `emergencyContactRelationship` (string).
- Stop reading `g12SchoolId`, `emergencyContactName2`, `emergencyContactNumber2` from responses.

If the frontend is not cut over, students will not be able to save the G12 school and will lose the
second emergency contact field.

## Pre-deploy

### 1. Back up (mandatory - migration 3 is destructive)

MySQL DDL is not transactional, so a failed `DROP COLUMN` cannot be cleanly auto-reversed. Restore
from backup if anything fails.

```bash
mysqldump -u <user> -p <database> students schools > backup_students_schools_$(date +%F).sql
```

### 2. Pre-flight data check on the client DB (read-only)

Confirm no student would lose its ONLY G12 reference. The backfill is a JOIN, so a student whose
`g12_school_id` points to a deleted school gets `g12_school_name = NULL`; dropping the column then
erases that reference.

```sql
SELECT COUNT(*) AS would_lose_g12_reference
FROM students s
LEFT JOIN schools sch ON s.g12_school_id = sch.id
WHERE s.g12_school_id IS NOT NULL AND s.g12_school_name IS NULL;
```

- Result `0`: safe to proceed.
- Result `> 0`: set a placeholder before deploying, for example:

```sql
UPDATE students s
LEFT JOIN schools sch ON s.g12_school_id = sch.id
SET s.g12_school_name = 'Unknown (school removed)'
WHERE s.g12_school_id IS NOT NULL AND s.g12_school_name IS NULL;
```

Note: the placeholder UPDATE must run BEFORE migration 3 drops the column. Run it as a manual step,
or hold migration 3 for a follow-up release and deploy only migrations 1 and 2 first.

### 3. Maintenance window / locking

Migration 3 uses `ALGORITHM=INPLACE, LOCK=NONE` (InnoDB online DDL) so the column drop does not lock
`students`. If the client's MySQL/engine rejects `LOCK=NONE` for this operation, remove that clause
from the migration and run inside a maintenance window instead.

## Deploy

1. Pull the release branch and build on the server.
2. Apply migrations (production uses deploy, never `migrate dev`):

```bash
npx prisma migrate deploy
npx prisma generate
```

3. Restart the application so the regenerated Prisma client is loaded.

## Post-deploy verification

### Schema

```sql
-- Expect only g12_school_name to remain:
SHOW COLUMNS FROM students LIKE 'g12\_school\_%';
```

### Data preserved

```sql
-- Existing applicants kept their G12 school name:
SELECT id, g12_school_name FROM students WHERE g12_school_name IS NOT NULL LIMIT 5;
```

### Application

- Create a student with `g12SchoolName` and `emergencyContactRelationship` -> 2xx.
- Update a student changing `g12SchoolName` -> 2xx, value persisted.
- Get a student -> response contains `g12SchoolName` and `emergencyContactRelationship`, and does
  NOT contain `g12SchoolId`, `emergencyContactName2`, `emergencyContactNumber2`.

## Rollback

Do not hand-reverse the DDL. If the deploy fails or verification is wrong, restore the tables from
the backup taken in Pre-deploy step 1:

```bash
mysql -u <user> -p <database> < backup_students_schools_<date>.sql
```

Then redeploy the previous application build.

## Notes / deferred work

- The second emergency contact DB columns (`emergency_contact_name2`, `emergency_contact_number2`)
  are retained. A later cleanup migration can drop them once confirmed unused, following the same
  backup + verify + online-DDL pattern used here for `g12_school_id`.
- Related session records: `docs/sessions/be/student-2026-07-09.md`,
  `docs/sessions/be/student-g12-school-2026-07-09.md`.
- API references: `docs/api/student/emergency_contact_api.yaml`,
  `docs/api/student/g12_school_api.yaml`.
