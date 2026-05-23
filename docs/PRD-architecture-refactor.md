# PRD: Backend Architecture Refactor

**Date**: 2026-05-02
**Status**: Proposed

---

## Problem Statement

The codebase has grown to 18 modules and ~11,000 lines of TypeScript, but several architectural patterns are creating friction that slows development and makes the codebase hard to navigate:

- **Every route handler duplicates the same error-handling block**, collapsing all errors into a single HTTP 400 response regardless of whether the error was a validation failure, a missing record, an authorization violation, or a database crash. This makes debugging harder and breaks HTTP semantics (forbidden responses return 400 instead of 403).
- **All input validators for all domains live in one 1,186-line file**, making it impossible to understand what validations apply to any given domain without scanning unrelated code.
- **The "who is making this request" question is answered in multiple service files** by re-decoding the JWT token ad-hoc, instead of once at the request boundary.
- **The sponsorship ranking operation** — the core algorithmic value of the system — is orchestrated across three separate locations (the sponsorship service, a utility converter, and a math utility) with no single module owning the ranking concept end-to-end.
- **Three lightweight modules** (dashboard, roles, address) have a three-layer controller-service-repository stack where the service layer does nothing but forward calls, adding indirection without benefit.

These issues collectively mean: tracing a bug requires jumping between many files; adding a feature requires understanding non-local rules; and the system's most important domain concept (ranking) has no clear home.

---

## Solution

Refactor the backend infrastructure to introduce proper seams at the places where behavior actually varies, and eliminate false layers where behavior does not vary:

1. Replace per-route try-catch blocks with typed error classes and a single Express error-handling middleware.
2. Split the monolithic validation file into domain-co-located validator modules with a shared factory for repeated patterns.
3. Move JWT decoding into authentication middleware that populates typed request context; services receive user context as a parameter.
4. Create a dedicated ranking module within the sponsorship domain that encapsulates criteria fetching, pairwise conversion, and AHP+TOPSIS scoring behind a single callable interface.
5. Collapse the three thin pass-through service layers into direct controller-to-repository calls.

---

## User Stories

1. As a developer fixing a bug in sponsorship application logic, I want all sponsorship-related validation in one place, so that I don't have to search through 1,186 lines of unrelated validators to find the rule I need to change.
2. As a developer adding a new route, I want error handling to be automatic, so that I don't have to copy-paste a try-catch block and remember which `ResponseHandler` method maps to which error type.
3. As a developer debugging a production 400 response, I want the error type logged with the response, so that I can tell immediately whether it was a validation error, a missing record, or an authorization failure.
4. As a developer reading a service function, I want user context passed as a parameter, so that I can understand what data the function depends on without knowing JWT decoding internals.
5. As a developer writing a test for a service function, I want user context to be injectable, so that I can pass a plain object instead of mocking JWT decoding.
6. As a developer investigating a ranking score discrepancy, I want all ranking logic in one module, so that I can trace the full scoring path — from criteria fetch to final rank — without switching between three files.
7. As a developer reading the dashboard module, I want direct controller-to-repository calls, so that I don't have to open a service file that only delegates to the repository.
8. As an API client receiving a 403 Forbidden response, I want the correct HTTP status code, so that I can distinguish "bad input" from "not authorized" in my error handling.
9. As a developer adding a new UUID-param validator, I want a factory function, so that I don't copy-paste an existing validator and change one string.
10. As a developer adding a new domain module, I want a clear pattern for validators, so that I know to put them in `<module>/validators.ts` rather than appending to a shared file.
11. As a developer tracing an authentication failure, I want token decoding to happen in one place, so that I can add logging or debugging in a single location.
12. As a developer writing a new service, I want to throw a typed `NotFoundError` and have it automatically map to 404, so that I don't need to know which `ResponseHandler` method to call.
13. As a developer writing a new service, I want to throw a typed `ForbiddenError` and have it automatically map to 403, so that authorization violations return the correct HTTP status without per-route branching.
14. As a developer reviewing a PR, I want controller files to contain only route wiring and no error-handling boilerplate, so that code review focuses on actual logic changes.
15. As a developer running the ranking algorithm on a new sponsorship, I want a single `rank(sponsorshipId, applicationIds)` call, so that I don't have to orchestrate criteria fetching, matrix conversion, and TOPSIS invocation manually.
16. As a developer testing the ranking algorithm, I want to test the full ranking path through a single module interface, so that I can inject a mock Prisma client once and exercise the entire flow.
17. As a developer working on criteria pairwise comparisons, I want the converter logic for ranking data to live inside the ranking module, so that changes to the ranking input format are localized.
18. As a coordinator changing a sponsorship stage transition rule, I want the stage-status validation logic in one place, so that I don't have to reconcile two copies of the rule (one in `validation.ts`, one in `sponsorship/service.ts`).
19. As a developer reading the roles module, I want a thin controller-repository structure, so that the absence of business logic is immediately visible, not hidden behind an empty service layer.
20. As a developer adding a new address lookup endpoint, I want a direct controller-to-repository structure, so that read-only lookups don't carry three-layer overhead.

---

## Implementation Decisions

### Recommended order of implementation

Do these in order — each item unblocks or simplifies the next:

1. **Typed error classes** — foundational; everything else depends on this
2. **Global error-handling middleware** — replaces all per-route try-catch blocks
3. **User context middleware** — move JWT decoding out of services
4. **Thin module collapse** — low-risk cleanup (dashboard, roles, address)
5. **Validation split** — domain-co-located validators replace the monolith
6. **Ranking domain module** — highest-value; done last because it needs typed errors

---

### Module 1: Typed error classes (`utils/errors.ts`)

- Introduce an `AppError` base class with `statusCode` (number) and `code` (string) fields
- Subtypes: `ValidationError` (400), `NotFoundError` (404), `ForbiddenError` (403), `DatabaseError` (500)
- Services and repositories throw typed errors; no caller catches them individually
- All existing `throw new Error(...)` calls in services and repositories migrate to the appropriate subtype

---

### Module 2: Global error-handling middleware (`middleware/errorHandler.ts`)

- Single Express error middleware registered last in `index.ts`
- Maps each `AppError` subtype to the correct `ResponseHandler` method and HTTP status
- Unknown/unexpected errors fall back to `internalServerError`
- All existing per-route `try { ... } catch (err) { ResponseHandler.invalidRequest(...) }` blocks removed from all 18 controllers
- `ResponseHandler.forbidden()` corrected to return HTTP 403 (currently returns 400)

---

### Module 3: User context middleware (`middleware/authentication.ts`)

- Decode JWT once inside the existing `authentication` middleware and attach a typed user object to `res.locals.user: { userId: string, email: string, roleName: string }`
- Export the `LocalsUser` type so service function signatures can declare typed parameters
- Remove all calls to `extractUserFromToken()` from service files
- Controllers extract `res.locals.user` and pass it as a parameter to service functions that need it
- `extractUserFromToken()` in `utils/utils.ts` can be kept as an internal helper but should not be called from services

---

### Module 4: Thin module collapse

- Delete `dashboard/service.ts`; `dashboard/controller.ts` calls the dashboard repository directly
- Delete `roles/service.ts`; `roles/controller.ts` calls the roles repository directly
- Delete `address/service.ts`; `address/controller.ts` calls the address repository directly
- No changes to any repository files or route paths

---

### Module 5: Validation split

- `middleware/validation.ts` becomes a thin barrel that re-exports only shared, cross-domain helpers
- Domain validators move to co-located files: `sponsorship/validators.ts`, `student/validators.ts`, `authentication/validators.ts`, `file/validators.ts`, `user/validators.ts`, `announcement/validators.ts`, etc.
- A `validateUUIDParam(paramName: string)` factory replaces 20+ near-identical UUID param validators (one line per use site)
- Stage-status transition validation unified: one authoritative copy lives in `sponsorship/validators.ts`; the duplicate logic in `sponsorship/service.ts` is removed
- `routes.ts` import paths update to pull validators from their new module locations

---

### Module 6: Ranking domain module (`sponsorship/ranking/`)

- Single public interface: `rankApplications(sponsorshipId: string, applicationIds: string[], prisma: PrismaClient) → Promise<RankedApplicant[]>`
- Internalizes: criteria fetching, pairwise matrix assembly, AHP weight calculation, TOPSIS scoring, result persistence
- `utils/ranking.ts` pure math functions (`calculateAHPWeights`, `topsis`) remain untouched — ranking module calls them
- Ranking-specific converter functions move from `utils/converter.ts` into `sponsorship/ranking/`
- `sponsorship/service.ts` replaces the current multi-step ranking orchestration (~6 function calls) with a single call to `rankApplications`

---

### API contracts

- No changes to any external API routes, request shapes, or response shapes
- HTTP status codes corrected: `403` for authorization failures (previously `400`)

### Schema changes

- None

---

## Testing Decisions

**What makes a good test**: Call the module through its public interface with realistic inputs and assert on outputs and thrown error types. Do not assert on internal implementation details (which helper was called, how many Prisma queries ran). For pure functions, use table-driven inputs and expected outputs. For modules that touch Prisma, inject a mock Prisma client at the module boundary.

### Modules to test

**Global error-handling middleware** (highest priority)
- Pass each `AppError` subtype into the middleware and assert the correct HTTP status code and response shape
- Pass an unexpected `Error` and assert it maps to 500
- This is the single seam for all error-response behavior — one test covers all 18 controllers

**Ranking domain module**
- Inject a mock Prisma client returning controlled criteria and pairwise comparison data
- Assert the ranked output order matches expected TOPSIS scores for known inputs
- Assert that ties are broken consistently
- This replaces the current untestable state where ranking logic is embedded in a 1,299-line service

**Validator factories**
- Call `validateUUIDParam('id')` with valid UUIDs, invalid strings, and missing params
- Assert the correct validation error messages are produced
- One test set covers all generated validators

**Authentication middleware**
- Pass requests with valid JWTs, expired JWTs, and malformed tokens
- Assert `res.locals.user` is populated correctly for valid tokens
- Assert that invalid tokens produce a `ForbiddenError` (not a crash)

**Prior art**: There is currently no test suite. These four modules are the recommended starting points — each is a seam that many other modules depend on.

---

## Out of Scope

- Changes to any external API routes, request payloads, or response payloads
- Database schema changes or new Prisma migrations
- UI or frontend changes
- Refactoring the `student`, `sponsorship`, `authentication`, or `file` module beyond what is described above
- Email templating improvements
- Adding authentication to currently-public routes (`/resources`, `/faqs`, `/static-content`)
- Prisma client singleton audit (all repos already use `utils/prisma.ts`; minor exceptions can be a separate cleanup PR)

---

## Further Notes

- **Recommended first move**: typed error classes + global error middleware. This is the highest-leverage change — one module eliminates boilerplate from all 18 controllers and fixes HTTP semantics.
- **Recommended warmup**: thin module collapse (dashboard, roles, address). Lowest risk, no logic changes, good first PR to establish the pattern.
- **`utils/converter.ts` will shrink** once ranking-specific converters move to the ranking module. The remaining converters (student and sponsorship response shapes) stay in place.
- **The `forbidden()` HTTP-status fix** (400 → 403) should be bundled with the error-handling middleware work, not shipped alone, since shipping it alone would change behavior in an uncontrolled way.
- **The ranking module refactor** creates the first meaningfully testable seam in the system's core algorithm and should be treated as its own PR.
