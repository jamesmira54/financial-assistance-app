# Document Tracking System (DTS) — backend implementation notes

Module: `documentTracking/` (controller, service, repository, `pdf.ts`), mounted at
`/api/v1/document-tracks` behind `authentication`.

## Data model

| Table | Purpose |
|---|---|
| `dts_process_types`, `dts_purposes`, `dts_offices` | Setup Manager lookups (name unique, `sort_order`, `is_active`, soft delete via `record_status`) |
| `dts_tracks` | One tracked document. `track_number` unique; `status`; `origin_office_id` (creator's office), `current_office_id` (holder), `intended_destination_id` (draft's chosen destination); `version` (optimistic lock) |
| `dts_track_histories` | Append-only movement log. `sequence` is unique per track. Office and actor names are snapshotted so the audit trail and PDF read as they did at the time |
| `dts_sequences` | Per-year counter for `DTS-YYYY-NNNNNN` |
| `users.dts_office_id` | The office a user receives/processes documents for |

Migration: `prisma/migrations/20260930000000_add_document_tracking_system` (additive only).
Office foreign keys are `RESTRICT`: offices are soft-deleted, never hard-deleted.

## Workflow

```
DRAFT ──SUBMIT──▶ SUBMITTED ──ACCEPT──▶ IN_PROCESSED ──FORWARD──▶ FORWARDED ──ACCEPT──▶ IN_PROCESSED …
                      │                     │   └──DONE──▶ DONE (terminal)
                      └──RETURN──┐          └──RETURN──┐
                                 ▼                     ▼
                              RETURNED (to the office that last SUBMITTED/FORWARDED it here)
                                 ├─ at an intermediate office → ACCEPT → IN_PROCESSED
                                 └─ back at origin → creator EDIT + SUBMIT (resubmission)
```

- The allowed actions per status are in `TRANSITIONS` (`documentTracking/service.ts`). Who may perform each one is checked in `canPerform`:
  - EDIT/SUBMIT: the creator. For a track returned to its origin, users of the origin office may also do these.
  - ACCEPT/FORWARD/RETURN/DONE: users whose `dts_office_id` equals the track's `current_office_id`. There is no admin bypass.
- The return destination comes from history, never from the client.
- Every transition runs in one transaction: read → authorize → compare-and-set on `(status, version)` → append history. A lost race returns "updated by someone else".
- Status, office, actor and timestamps are never read from the request body.
- The response includes `allowedActions` for the calling user, so the UI can show only the buttons that user can use. The server enforces the same rules either way.

## Visibility

- Drafts are visible only to their creator.
- Admins and coordinators see all non-draft tracks.
- Office users see tracks their office holds or has sent/received (from history).
- Users with no office and no creator role get an error.

## API

OpenAPI spec: `docs/api/documentTracking/document_tracking_api.yaml`.
UI team guide (screen-by-screen API usage, error handling, TS types):
`docs/api/documentTracking/UI_INTEGRATION_GUIDE.md`.
Tests: `documentTracking/documentTracking.test.ts` (mocked Prisma) and
`test/documentTracking.e2e.test.ts` (real DB, cleans up after itself; run with
`npx jest test/documentTracking.e2e.test.ts --runInBand --forceExit`).

| Method | Path | Notes |
|---|---|---|
| GET | `/me` | Current DTS user: office, `canCreate` |
| GET | `/` | List. `search` (track no./title), `status`, `processTypeId`, `purposeId`, `sponsorshipId`, `currentOfficeId`, `createdFrom/To`, `submittedFrom/To`, `inbox=true`, `offset`, `limit`, `sort` |
| POST | `/` | Create. `submit: true` = Create and Submit (then `destinationId` is required) |
| GET/PUT/DELETE | `/:trackId` | Detail (with history); edit draft/returned-to-origin; discard a draft |
| GET | `/:trackId/history` | Persisted history |
| GET | `/:trackId/pdf` | `application/pdf`; submitted tracks only |
| POST | `/:trackId/submit` | `{ destinationId?, remarks? }`. `destinationId` defaults to the draft's intended destination |
| POST | `/:trackId/accept` | `{ remarks? }` |
| POST | `/:trackId/forward` | `{ destinationId, remarks }` (both required) |
| POST | `/:trackId/return` | `{ remarks }` (required) |
| POST | `/:trackId/done` | `{ remarks }` (required) |
| GET | `/setup/:kind` | `kind` = `process-types` \| `purposes` \| `offices`; `?active=true` for dropdowns |
| POST/PUT/DELETE | `/setup/:kind[/:id]` | admin, coordinator. DELETE is a soft delete; it is refused for an office holding open tracks |
| GET | `/setup/offices/:id/users` | admin, coordinator |
| PUT | `/setup/user-offices/:userId` | `{ officeId \| null }`, admin only |

Authorization failures use `ResponseHandler.forbidden`, which in this codebase returns HTTP 400.

## Decisions on ambiguous requirements

- **Process Type vs Purpose.** The Create Track spec used `SCHOLARSHIP_VOUCHER` / `FOR_PROCESSING` style enums, and the Setup Manager spec used a wider list. Both are now DB-driven lookups, seeded from the Setup Manager lists. "For Processing"-style values are Process Types, and "Scholarship/Assistance Voucher"-style values are Purposes. The API takes and returns IDs plus display names (`processTypeId` + `processType`) in place of the hardcoded TS unions.
- **Offices and users.** The system had no office concept, and the seeded office *roles* don't match the DTS destination list. DTS offices are therefore their own table, and users are linked through `users.dts_office_id`. A new `DTS Officer` role covers DTS-only accounts. Any role can be assigned an office.
- **Permissions.** The existing `permission` middleware is a stub, and access is role-based. So `DTS_*` permissions are enforced as follows:
  - Create: `system admin` or `financial assistance coordinator` (`DTS_CREATOR_ROLES`).
  - Workflow actions: office ownership.
  - Setup: `allowRoles`.

  Module rows (Document Tracking, and Setup Manager > Process Type / Purpose / Destination) are seeded for the UI's module permissions.
- **Track number.** It is assigned at creation, including for drafts, so a track's number never changes.
- **Forwarded → Return.** It is not allowed, per the spec's transition table. The receiving office must accept a track before returning it.
- **PDF.** The project had no PDF library, so `pdfkit` was added. The PDF is built from the persisted track and history.
- **Notifications.** The existing `notification` module is reused with the new type `document`. Submit, forward and return notify the receiving office's users (or the creator, when a track is returned to them). Done notifies the creator. Notifications are best-effort and sent after commit.

## Setup

```bash
npx prisma migrate deploy   # or db-reconcile on a diverged DB (see memory notes / scripts/reconcile-db.ts)
npm run prisma-dts          # default process types, purposes, offices, DTS Officer role
npm run prisma-modules      # module rows for the UI permission tree
```
