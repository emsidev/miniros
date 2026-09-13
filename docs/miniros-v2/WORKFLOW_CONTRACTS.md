# EP01 interface freeze — conceptual version 2

Single writer: lead integrator. Source API: `packages/contracts/src/staff-workflow.ts`.
This is a compile-time/conceptual boundary for subsequent plans, not a network protocol
accepted by production. Existing `offlineEnvelopeSchema` remains schemaVersion 1;
no migration, decoder loosening or queued legacy action rewrite is authorized.

## State transitions and guarded actions

| Machine   | Allowed transition/action                                                       | Required guard / authority                                                          |
| --------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Staff     | scheduled → prepared                                                            | assigned cashier epoch, connected snapshot readiness                                |
| Staff     | scheduled → cancelled                                                           | assigned authority; audited scheduling cancellation adapter later                   |
| Staff     | prepared → packing                                                              | assigned cashier                                                                    |
| Staff     | packing → departure-ready                                                       | all critical supplies resolved/authorized exceptions                                |
| Staff     | departure-ready → opening-count                                                 | assigned cashier                                                                    |
| Staff     | opening-count → open                                                            | nonempty relevant lines resolved, explicit review; seals counts                     |
| Staff     | open → closing-draft → open                                                     | retains original opening seal, no planned-end lock                                  |
| Staff     | closing-draft → closed-locally                                                  | close review and prep resolution; no cloud/media condition                          |
| Staff     | closed-locally / cancelled                                                      | terminal; correction is a new audited revision, never rewrite                       |
| Prep      | new → making → done                                                             | authorized stable command, cashier canonical acceptance                             |
| Prep      | new/making → cancelled                                                          | explicit validated resolution and retained audit; no delayed Start undo of Done     |
| Checklist | unchecked ↔ packed/missing; missing → authorized exception                      | cashier editor; template version, actor/time, reason + permission for exception     |
| Count     | uncounted / counted(q) / not-brought                                            | cashier, opening-count state, finite nonnegative q; sealed edits rejected           |
| Cloud     | not-received → receiving → in-sync through N / gap-or-conflict → final-received | contiguous committed sequence plus matching manifest; duplicates return old receipt |
| Review    | not-reviewed → needs-review → reviewed                                          | owner permission; new evidence/correction can require renewed review                |

`staffTransitions` exhaustively enumerates permitted staff edges. Guards and tests
are in shared code, not invented in components. Cancellation authorization adapters,
checklist exception verification, cloud and review transitions remain conceptual in
EP01 and must be implemented in their owning plans. A typed boolean is not a grant
verifier. Initial authority assignment must be atomic server-side in EP05/07;
`assertCashier` demonstrates rejection of a competing claimant, not a locking service.

## Existing model mapping / additive boundary

| New concept                              | Existing source / adaptation                                                                                                                             |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| owner schedule draft                     | shift-planning.ts, operations.ts, shifts/assignments; add planned times/address API later, retain optional historic costs                                |
| prepared / packing / departure / opening | PreparedShift + OfflineSnapshot in offline.ts; preparation remains one snapshot, new readiness substates are additive                                    |
| open / closed locally                    | LocalShiftProjection currently unopened/open/closing; do not overload server session status prepared/active/closing/closed/recovery/released             |
| sealed opening                           | START_SHIFT immutable operation and opening-draft.ts; new CountAnswer distinguishes observation statuses before seal                                     |
| stock/order/payment                      | existing OfflineOperation/operations.ts + shared calculation/domain modules; no duplicated financial reducer in EP01                                     |
| immutable v2 envelope                    | existing OfflineEnvelope ID/session/snapshot/sequence/occurredAt retained conceptually; add explicit business/shift/hash/installation/epoch/authenticity |
| local atomic save                        | existing Dexie appendShiftAction; new SQLite adapter planned EP04, old browser DB retained                                                               |
| receipts/media                           | current LocalAction.status and LocalProof.synced; new peer/cloud receipts and attachment job state remain separate, planned EP11/13                      |
| completeness/manifest/review             | existing acknowledgedSequence + closeout review/profit services; add gaps/final boundary without assuming uploaded photos                                |
| grants/checklist/recovery mirror         | no current equivalents; scoped extensions EP05/07/08/16, not duplicate catalogs/shifts                                                                   |

Proposed commands: PrepareScheduledShift(assignment revision), SaveChecklistAnswer,
SaveOpeningDraft, SealOpening, CommitSale, RequestPrepTransition, RecordStockEvent,
CloseLocally, DeliverOperation, DeliverAttachment, ImportRecovery. Each future adapter
must authorize tenant/shift/role/installation/epoch and reject same ID/different payload.
Success means durable commit in the named destination; errors distinguish retry,
authorization, invalid payload, conflict, gap, storage failure and missing attachment.
Retain rejected evidence and keep unrelated tenants/shifts progressing.

`V2OperationProposal` requires protocol/schema version 2, tenant/shift, frozen snapshot
ID/hash, origin installation, epoch, stable ID, sequence, kind, occurrence time, payload,
canonical digest and reviewed authenticity evidence. Receipt time is separate; IDs
and contiguous sequences determine identity/order, not user-editable clocks. No digest
algorithm/key format is declared secure by this type. No production v2 transport yet.

## Product defaults / screen ownership

Owner setup and schedule: owner/web. Join/Pack/Count/Sell/Close: mobile cashier;
Prep: assigned prep, view checklist and issue prep commands only. Reusable business
setup automatically feeds preparation; opening cash is staff-entered. One cashier,
no failover, no silent oversell, no central debit from opening, no closing-time lock.
Existing historical features retain their routes.

Visual contract: existing `packages/ui/src/tokens.json` source; Outfit, ink #111318,
canvas #F5F5F5, accent #D9FF35. At least 48px interactive targets, visible focus,
semantic labels, readable text feedback instead of color-only states, compact phone
layout. Miniros brand retained. Walkthrough rendering is browser W, not native proof.
