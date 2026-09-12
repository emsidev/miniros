# MINIROS connected staff workflow and offline PWA

## Outcome and release boundary

Implemented in the existing framework and identity. One selling shift on one authoritative prepared PWA device is the boundary. Initial installation, sign-in and preparation require internet. No offline peer networking, production, prep queue, new refund workflow, framework replacement, broad dependency upgrade or Sites skill.

This is engineering implementation evidence, **not pilot release acceptance**. Hosted migration, physical installed-device tests and novice-staff testing remain required.

## Preserved baseline

Started from commit `0056f316cf811f10f943d56c4c987b1642844938` on `dev`, with 172 existing modified, deleted or untracked paths. Existing native EP02–EP05 code and evidence were preserved. No reset, destructive checkout, commit, deployment or hosted migration was performed.

The native-first roadmap is superseded **for this PWA release only**. MASTER_PLAN.md and EXECUTION_STATUS.md retain their native history with a release-scope banner. Default-off native authority flags and reciprocal native/PWA authority checks remain enforced.

## Before / After / Why

| Before                                                      | After                                                                                                                            | Why                                                               |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Disconnected staff modules and repeated selectors           | Labelled Shift · Sell · More, shared shift context; protected switches in More                                                   | Staff complete a shift, not a database diagram                    |
| Navigation-bound selection and fragile checkout/count state | Identity/business-scoped selection, validated deep links, durable scoped drafts and operation IDs                                | Returning or reopening must not lose or move work                 |
| Expected quantities treated as actual counts                | Blank actuals, explicit zero/Not brought, progress and Stock → Cash → Review                                                     | A projection is not an observation                                |
| Upload failure held another checkout                        | Durable local evidence; separate financial and attachment retry coordinators/leases                                              | Slow photos must not stop selling or later financial uploads      |
| Large POS chrome and obscured desktop Charge                | Compact common context, touch catalog, measured 390px order panel with visible footer; phone order sheet and full-screen payment | Recognizable controls stay reachable                              |
| Production-dependent product stock and ambiguous float      | Simple direct-stock link, automatic stock item, required new opening float, frozen prepared costs                                | Pilot selling should not require Production; float is not revenue |

Impeccable shaped operational hierarchy and required an independent finish review. Emil shaped continuity and reachable action areas. GPT Taste shaped spacing/type/contrast within the pinned identity. Caveman kept task copy short. Existing token-bearing DESIGN.md and sidecar remain normative; the staff surface brief records this release's scoped extension.

Public inspiration: Mobbin [labelled tab bars](https://mobbin.com/glossary/tab-bar), [stacked lists](https://mobbin.com/glossary/stacked-list), [bottom sheets](https://mobbin.com/glossary/bottom-sheet). No copied brand or full-library access is claimed.

## Implemented workflow

- Staff selection survives navigation/reload by identity and business. Valid explicit deep links win; a single eligible shift can auto-select, but several never silently choose one.
- Online preparation requests PWA contract 2, validates local snapshot/storage and worker shell before Ready offline. Static public /offline entry bootstraps from scoped local identity and data; private owner HTML/API responses stay outside public shell caching.
- Opening requires every actual stock count and explicit opening cash, including deliberate zero. Closing is a durable Stock → Cash → Review draft; it does not seal until final submission, and subsequent sales update expected totals without replacing actuals.
- Search/category/touch catalog, editable order quantities/discounts, visible Cash/GCash/Card and More tenders, numeric cash and relevant shortcuts. Phone View order opens one sheet, then full-screen payment; desktop has a sticky measured 390px panel.
- Journal/projection/evidence bytes/draft transitions commit atomically. A prepared sale receipt appears only after that commit. Storage failures preserve the editable/frozen request and do not confirm success. New sale is independent of attachment upload.
- Cart, tender, photos, counts, cash, notes, workflow step, expense/adjustment drafts and stable operation IDs persist. Shift-keyed mounts and scoped records prevent moving drafts between shifts.
- Financial actions upload in sequence. Evidence has an independent coordinator and lease. Authentication expiry pauses upload without erasing work; upload details separate transactions and attachments with errors. Legacy photos also retry without a prepared shift.
- Legacy carts from both existing stores import with verification, conflict protection and stable IDs. Originals remain retained after import; import markers prevent resurrecting cleared checkouts. Logout/business-switch guards include unsent transactions, payment/promo photos, discounts and active drafts.
- Authorized online fallbacks let already-active unprepared legacy shifts finish without bypassing native/PWA reservation guards.
- Owner navigation is Today · Shifts · Catalog · Reports · More. Simple products default to name/price/cost/direct stock with automatic linked item; optional recipes/produced behavior remains. Shift setup includes venue/time/people/costs and Sell myself uses the same staff tree.
- Owner shift results expose sales/product costs/shift costs/expenses, cash and stock differences, profit and pending upload/review status. Unsent device records are explicitly not represented as uploaded data.

## Contract and database change

Migration: `supabase/migrations/20260912114907_bored_malcolm_colcord.sql` plus generated snapshot/journal metadata. Adds opening cash and tenant-scoped product-to-stock mapping, with the supporting inventory unique index before the composite foreign key.

**Not applied to a hosted database.** It was applied in PGlite workflow/migration tests. Apply through the project's normal reviewed migration process before real-account preparation; retain all earlier native migrations.

Original v1 journals remain accepted unchanged: IDs, sequences and canonical digests are not regenerated. Legacy missing opening cash means zero. PWA snapshot/envelope version 2 is distinct from native v2 authority. Prepared prices/costs remain fixed for an existing journal.

Expected closing cash = opening float + cash sales − applicable cash expenses. Opening float is neither revenue nor profit. Direct stock deducts one linked inventory unit per unit sold; it does not require Production. Existing recipes/produced products and approval requirements remain enforced.

## Automated evidence — 2026-09-12

| Check                                      | Result                                                                                          |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Portable web suite (37 files)              | 35 passed, 2 skipped; 168 passed tests, 13 conditional skipped                                  |
| Focused sync / legacy evidence / PWA retry | 3 files, 9 passed                                                                               |
| PGlite offline workflow and accounting     | 29 passed, including original v1 cases and new direct-stock/float/report fixtures               |
| Contracts                                  | 143 passed                                                                                      |
| Domain                                     | 110 passed                                                                                      |
| Native mobile reducer/storage              | 123 passed                                                                                      |
| DB/planning subset                         | 32 passed, 4 conditional skipped                                                                |
| Web / DB / E2E typechecks                  | Passed                                                                                          |
| Production web build / generated worker    | Passed; static /offline shell, 134 precached static assets; private pages excluded              |
| Public shell network-failure smoke         | Reopened cached staff shell with the owned local server stopped; no prepared shift/data claimed |
| Whitespace / conflict check                | git diff --check passed                                                                         |

Final production worker cache ID: `Qqz2QoVys1t3yIkdN3_s-`. Build completed with lint/type validation and static generation; temporary preview/production servers were stopped after verification.

Portable command:

```sh
pnpm --filter @miniros/web exec vitest run --exclude '**/native-v2/backend.db.test.ts' --exclude '**/native-v2-review/*.test.ts'
pnpm --filter @miniros/e2e exec vitest run src/offline-workflow.test.ts
pnpm --filter @miniros/web typecheck
pnpm --filter @miniros/web build
```

The four excluded native PostgreSQL files are **not claimed passing**. Their expected local PostgreSQL service at port 55432 is unavailable here. Existing PostgreSQL-conditional concurrency cases remain skipped, not weakened.

The real client coordinator regression acknowledges a later financial action while an earlier evidence request is still unresolved, then verifies failed evidence is retained. Legacy evidence tests verify receipt+payment/promo bytes, next-cart independence, original-account isolation and atomic quota-failure rollback.

Synthetic accounting fixture passes local projection, server replay/reconciliation and owner report: opening stock10, sell3 cash+1 GCash at₱100/cost₱40, float₱500, rent₱100+transport₱20+wages₱50, cash expense₱30 → **stock6, sales₱400, cash₱770, profit₱40**.

## UI evidence and review

`.impeccable/review/` contains desktop1440x1000, user1280x900 and phone390x844 captures of actual shared components, order/payment, overview and blank opening/closing counts. The development preview uses an isolated database and synthetic data, and cannot submit real financial operations or uploads.

Captures are validated viewport-from-document-top images. The embedded full-page capture output was malformed and is not used as evidence. Browser automation is not installed-device offline acceptance. A public-shell reload with the owned local production server stopped reopened the cached staff shell without SSR authentication or database access; this was an empty/unprepared workspace, not a completed offline shift. The first tab-only CDP network-emulation attempt was inconclusive (service-worker fetch context was not established as offline and navigation hit an error-page policy); it is not recorded as passing.

Fresh finish reviewer disposition: **ship for the four scored correction fixes**; all four resolved. See `.impeccable/review/finish-verdict.md`. The one design-system detector result was empty; no repeated detector or new visual-concept round was run.

Original PWA icon PNG bytes were restored from the baseline HEAD, not redesigned or generated. Screenshot evidence is development-only, not shipping raster artwork.

## Pilot release checklist — still outstanding

- [ ] Apply the reviewed migration to the intended environment and verify real-account preparation, tenant isolation, reserved/native conflicts and authorized recovery.
- [ ] Run the excluded native PostgreSQL regressions and real concurrency/idempotency cases with their expected database service.
- [ ] On physical Android Chrome and iPhone Safari, install/sign in/prepare online, then airplane-mode opening, five sales, expense and actual closeout, including full app kill/reopen.
- [ ] Refresh/navigate/kill at opening, cart/tender and each closing step; verify same shift, actuals and stable IDs recover.
- [ ] Inject repeated taps, lost responses and replay; verify one sale/inventory movement. Fail evidence upload and verify later sales/financial uploads continue.
- [ ] Inject quota/storage failure; verify no false saved status or receipt. Re-test original-cart migration, logout/business switching and account/tenant changes.
- [ ] Three unfamiliar staff each open, make five sales, record one expense and close without coaching or losing context.
- [ ] Confirm incomplete uploads and owner reviews remain visibly pending before location-profit decisions.
- [ ] Release to one business only after the gates pass; freeze feature expansion until then.

Browser persistence/background upload remain best effort. Browser-data erasure can destroy unsent work; there is no promise to recover erased bytes. See [MDN storage limits and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).
