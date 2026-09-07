# Miniros v2 — complete implementation and execution plan

**Prepared:** 7 September 2026. **Repository:** `emsidev/miniros`. **Reference baseline:** `d073cbbc0f78bf2e9142a663a70009c60158c8a1`.

**Decision: improve Miniros in place with a targeted rebuild of staff operations. Do not start a new project or throw away the existing backend and tested business rules.** This pack is an execution specification, not implemented code or a claim of completed app testing.

## Product promise

The owner maintains the business standards once and schedules only the venue, date/times and assigned people. Staff checks required supplies before departure, counts what is actually at the booth at opening, takes/prepares orders on two phones, and closes with calculated sales and expected inventory. Phones operate locally through internet outages; cloud delivery updates the owner when possible.

The owner's per-shift work must NOT expand into choosing products, preallocating opening stock, assembling QR payloads or rebuilding checklists. Data preparation is automatic application behavior. See `PRODUCT_AND_ARCHITECTURE.md` for the binding details, security boundaries and unresolved technology gates.

## How to execute this pack

Start with `START_HERE_CODEX.md`. Put the pack under `docs/miniros-v2/` in the existing repository, preserving current instructions/data. The lead reads common contracts once, delegates only the relevant execution plan/context to workers, and owns integration. Each plan includes four work slices, exact outcome assertions, a completion gate and rollback/preservation guidance.

Required common documents:

- `PRODUCT_AND_ARCHITECTURE.md`: product, state, authority, stock, security and closeout contracts.
- `AGENT_EXECUTION_RULES.md`: actual subagent usage, file ownership, review and evidence rules.
- `TEST_STRATEGY.md`: command truth, fixture oracle, fault matrix, physical/hosted gates and proposed targets.
- `fixtures/golden-shift.json`: synthetic inputs and independently calculated expected results.
- `EXECUTION_STATUS.md` and `templates/`: persistent implementation/evidence/checkpoint tracking.

This repository contains the split edition as the active source. The separately supplied `MINIROS_V2_COMPLETE_CODEX_PLAN.md` is the combined pasteable edition of the same specification; it is intentionally not duplicated here. `TEST_CASE_INDEX.json` is a machine-readable index of all specified acceptance cases. `REQUIREMENTS_TRACEABILITY.md` maps the product contract to them.

## Sequencing and agent use

Do not launch all plans at once. Execute the dependency graph below; use parallel read-only exploration initially and separate writable scopes thereafter. The lead owns contracts/migrations/lockfiles; an independent agent reviews each package. Start with at most three concurrent subagents.

A useful progression is:

| Wave | Plans | Parallelism boundary |
|---|---|---|
| A — Understand and contract | EP00, then EP01 | Read-only audits may run together; the lead fixes one contract. |
| B — Prove foundations | EP02 and EP03; then EP04 and EP05 | Native transport and pure domain work can be independent. Storage and server implementations share an already-fixed contract. |
| C — Owner and readiness | EP06 → EP07 → EP08 → EP09 | Owner setup can progress alongside storage once backend contracts exist. Enrollment waits for required interfaces. |
| D — Local booth loop | EP10 → EP11 and EP12 | Prep and stock-exception work can run in disjoint modules after checkout is stable. |
| E — Visibility and closeout | EP13 and EP15 in parallel; EP13 → EP14; then EP16 | Local closing must work before cloud completion. Dashboard and closing are separable; recovery depends on ingestion and close manifests. |
| F — Validate and release | EP17 and EP18 → EP19 | UI polish and release hardening can run separately; all required gates precede rollout. |

A physical EP02 gate may be pending while portable domain/storage/UI work is developed behind adapters/flags. That does not authorize claiming the transport works, selecting an untested production runtime, or releasing a two-phone app. Code-complete, automated-verified, device-verified and release-accepted are different statuses.

## Execution-plan index

| ID | Work package | Implementation dependencies | Lead role |
|---|---|---|---|
| EP00 | Baseline audit, preservation, and truthful test inventory | None | Lead |
| EP01 | Product contract, architecture decisions, and runnable UX skeleton | EP00 | Lead |
| EP02 | Native two-phone communication feasibility spike | EP01 | Mobile/connectivity agent |
| EP03 | Shared domain model, operation contracts, and golden arithmetic | EP01 | Domain/data agent |
| EP04 | Crash-safe native SQLite ledger and independent queues | EP03 | Mobile persistence agent |
| EP05 | Backend persistence, native authorization, and safe ingestion | EP03 | Owner/backend agent |
| EP06 | Owner reusable business setup and lightweight shift scheduling | EP03, EP05 | Owner web agent |
| EP07 | Staff enrollment, automatic snapshots, and departure preflight | EP02, EP04, EP05, EP06 | Mobile enrollment agent |
| EP08 | Departure checklist with missing-item handling | EP07 | Mobile workflow agent |
| EP09 | Intuitive opening-stock counts and opening seal | EP08, EP03 | Mobile inventory agent |
| EP10 | Cashier checkout and durable order creation | EP09, EP04 | Mobile cashier agent |
| EP11 | Reliable prep queue and bidirectional local synchronization | EP10, EP02 | Mobile/connectivity agent |
| EP12 | Operational inventory, remakes, refunds, waste and restocks | EP10, EP03 | Domain/mobile inventory agent |
| EP13 | Independent cloud synchronization, media retry and auth recovery | EP05, EP07, EP10, EP11, EP12 | Backend/mobile sync agent |
| EP14 | Owner live dashboard with honest freshness and reconciliation | EP06, EP13 | Owner web agent |
| EP15 | Offline local closing, actual counts and owner review | EP11, EP12 | Mobile closeout/domain agent |
| EP16 | QR recovery export, offline owner import and duplicate-safe handover | EP05, EP07, EP13, EP15 | Mobile/owner recovery agent |
| EP17 | Staff usability, accessibility and end-to-end workflow polish | EP08, EP09, EP10, EP11, EP12, EP14, EP15, EP16 | UX/mobile/owner agents with disjoint screens |
| EP18 | Migration safety, observability, CI and release hardening | EP13, EP14, EP15, EP16 | Lead/backend/release agent |
| EP19 | Physical acceptance, full-shift pilot and authorized rollout | EP17, EP18 | Lead |

## Definition of completed implementation

Every in-scope workflow exists in the running application, not as an unconnected mock or placeholder. Local/core workflows are covered by real tests and numerical fixtures. Server mutation paths remain authorized, tenant isolated and idempotent. The lead integrates and reruns checks; every package has independent review and migration/rollback notes. All required tests are mapped to evidence, not only described in a Markdown document.

## Definition of release readiness

Physical Android/iPhone role combinations, full offline cold-start-to-closeout, failure recovery, hosted Auth/Storage/RLS/Realtime, real camera handover, legacy migration/rollback, staff usability and the full-shift rehearsal are verified. All release gates in `TEST_STRATEGY.md` are accepted. The owner explicitly authorizes the pilot/deployment. No required test remains silently skipped, and no data-loss/security/duplicate-money/false-receipt defect is open.

A Codex session without phones, signing access or hosted credentials can finish code and automated tests, but must report those external gates blocked. It must still finish all independent work and provide an actionable checkpoint—not declare the project finished, invent evidence, or repeatedly ask whether to continue ordinary implementation.

## Important existing-code constraints

The inspected repository already has Next.js, Expo and shared TypeScript workspaces [R2]. Preserve the useful local/replay invariants described in the prior review and revalidate them in EP00 [R7]. The mobile test command is a placeholder, its build is a web export, and the existing e2e command is a Vitest workflow suite [R4–R5]. Replace missing validation with actual suites/builds; do not treat a root green command as device acceptance. Root `db:migrate` targets `supabase db push`, so it is not an automatically safe local step [R3]. The current acceptance document openly leaves physical/hosted work pending [R6].

Read `SOURCE_REGISTER.md` for the inspected source boundaries and technical references. Current local code takes precedence over a stale filename assumption; the user's latest workflow takes precedence over an older product proposal.
