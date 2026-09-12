# Documenter report — connected staff PWA extension

Date: 2026-09-12. Documentation disposition: complete for the approved ordinary extension. This is not pilot release acceptance or a new full-surface review.

## Authority and retained system

Read PRODUCT.md, AGENTS.md, the complete Impeccable skill, document.md and new-work.md, root DESIGN.md, .impeccable/design.json, the staff surface brief, direction-contract.md, quality-bar.md and finish-verdict.md. The main agent had already completed session context loading; it was not rerun.

PRODUCT.md remains product truth. The token-bearing root DESIGN.md exists and remains the normative visual system; its existing extension sidecar also exists and is retained. Neither file was refreshed, overwritten or merged: no durable system change was authorized. A byte comparison against current HEAD confirmed both unchanged:

| Retained file           | SHA-256                                                            |
| ----------------------- | ------------------------------------------------------------------ |
| DESIGN.md               | `03f3c826b42e02203a535fa31112bebdca088dd0527e639c284b9ab8d45c58d9` |
| .impeccable/design.json | `373f0d8b9ad2bc130dbd37942555e0cc141efb72fe1ef994217a64049e3b987c` |

The source-of-truth boundary is consistent with an ordinary extension: product truth stays in PRODUCT.md; shared visual primitives stay in DESIGN.md and packages/ui/src/tokens.*; the approved staff task hierarchy, state continuity and release-local composition stay in the staff surface brief. Its six contract blocks remain present. FORM explicitly records the user-pinned/code-led precise-brief exception and that no seed key, concept roll, comp round or replacement world was authorized; no invented seed was added.

## Finished-build consistency checked

Inspected the actual EmployeeShellFrame, EmployeeNavigation/provider, SelectedShiftLanding, ShiftContext, CountRows/count model/ShiftCountWorkflow, PosForm and PosOrder, staff rules in globals.css, token sources and existing BrandMark.

- Product font aliases remain Outfit; ink/canvas/surface/accent resolve to the shared tokens. The existing geometric M is retained, not replaced by a functional shop/cart icon. Flat rows, dividers, tabular amounts and restrained chartreuse remain the operating language.
- Shift/Sell/More remain visible labels with permission-aware destinations and an explicit active state. The preference is identity-scoped; SelectedShiftLanding restores only an eligible server-validated assignment and does not silently choose among several eligible shifts. Context exposes venue, status and actual date; missing date is explicitly unavailable.
- Staff buttons/inputs and quantity actions derive their touch sizing from the existing 48px step (`--mi-space-12`), with visible focus and reduced-motion sheet overrides. This is scoped staff guidance, not a rewrite of the 44px system default for owner/native controls or a new token.
- Blank actual counts remain blank, with explicit “Not brought · 0” for opening stock, progress/search/group filtering and Stock → Cash → Review. Actual cash is explicit. Draft state preserves entered actuals separately from displayed expected closing values and exposes save failure rather than declaring success.
- Desktop POS uses the shared order/tender model in a measured sticky 390px panel; its body scrolls separately from the amount-labelled Charge action. Phone uses View order, one contextual order sheet, then full-screen payment/receipt with venue/date and Back to order. Cart/tender/step/IDs recover from scoped drafts. Receipt/evidence handoff and independent financial/evidence behavior are covered by the supplied engineering/reviewer evidence, not newly certified by this documentation pass.

## Explicit scope conflicts, not silent repairs

DESIGN.md retains older route-specific immersive POS prose, including a dark shift-context bar and a uniform phone bottom-sheet composition. The approved staff brief explicitly overrides those compositions for this connected staff PWA release only. It does not promote the new composition into a global design rule or repair historical prose as an incidental refresh. The user-pinned Outfit/ink-white/rare-chartreuse/geometric-M identity remains binding despite generic new-world saturation warnings.

The staff release uses one authoritative prepared PWA device and retains native history/authority guards; it is not a native-platform redesign. No Sites workflow, deployment, hosted migration, new detector, visual-direction round or broader audit was performed by the documenter.

## Evidence and review scope

Opened all eight supplied images: desktop.png (1440×1000), user-1280.png (1280×900), and phone 390×844 mobile.png, mobile-order.png, mobile-payment.png, mobile-overview.png, mobile-opening.png and mobile-counts.png. Each depicts the named top-of-document viewport/state without blank/black or half-loaded content. The captures show the retained identity, labelled navigation, desktop Charge, phone order/payment continuity and visible blank actual-count input.

These are isolated synthetic development captures of actual shared components, visibly labelled synthetic where the shell is present, not commercial proof, installed-PWA testing or shipping artwork. The embedded browser's malformed full-page output is excluded; these viewport-from-top files are the evidence. Screenshot review cannot certify durable browser storage under device eviction, hosted account preparation or physical airplane-mode cold-start.

Existing detect.json contains `[]`; no second detector was run. finish-verdict.md records disposition **ship limited to the four scored fixes**, all resolved: durable direction/quality documents, reachable desktop Charge, visible blank phone count input, and legacy attachment independence from next checkout/financial queue. Documentation does not enlarge that verdict into whole-surface approval.

## Shipping raster provenance

No new raster identity or artwork was generated for the extension. apps/web/scripts/restore-pwa-icons.mjs restores the original pre-existing MINIROS PWA PNGs. Read-only byte comparison against current HEAD verified all four shipping rasters unchanged:

| Existing raster in apps/web/public/icons | SHA-256                                                            |
| ---------------------------------------- | ------------------------------------------------------------------ |
| apple-touch-icon.png                     | `d0eef2ddc9861d93f47b9075e48d328e8757465c6212e0e056652b71be186975` |
| icon-192.png                             | `2272f16f6adeda0911a3b542d25815f074d03a4dac921931e760fbd5db2b47a2` |
| icon-512.png                             | `ce9f064b3cad9ff36e1bbd594dba15ff1027e04cd44078f764268a359aa81b76` |
| maskable-512.png                         | `d834c512b1058286311020341a40ff3659d87dd6d701aff4180cd52f2e07a72d` |

The baseline HEAD bytes are their origin; no claim of newly generated or sourced assets is made. Development screenshot PNGs remain review evidence, not shipping raster artwork. This pass did not modify icon bytes or evidence files.

## Engineering handoff and release gates

Supplied main-agent evidence, not rerun here: portable web 168 passed/13 conditional skipped; focused sync/legacy evidence/PWA retry 9 passed; PGlite E2E/workflow 29 passed; prior contracts 143, domain 110 and mobile 123 passed; typechecks passed. Final production-build/worker outcome is owned by the main agent and recorded in docs/PWA_OVERHAUL.md; this documentation pass does not certify a build still running during handoff.

Release gates remain: reviewed hosted migration and real-account preparation (not applied), excluded real PostgreSQL native regressions/concurrency with the unavailable localhost:55432 service, physical installed Android Chrome and iPhone Safari airplane-mode cold-start/kill-reopen acceptance, and three unfamiliar staff walkthroughs. Synthetic capture and PGlite passes do not substitute for these gates.

## Persisted guidance and write boundary

Edited only:

- apps/web/.impeccable/surfaces/omponents-shared-employee-shell-frame-tsx-64157cba.md — scoped operational guidance, explicit historical POS override, retained-system/provenance/release boundary.
- .impeccable/review/documenter-report.md — this retained-system evidence report.

No product truth, UI code, normative DESIGN/sidecar, native files/evidence, raster assets, deployment or docs/PWA_OVERHAUL.md were edited. Documentation finish is discharged at the ordinary-extension scope; physical release acceptance remains outstanding.
