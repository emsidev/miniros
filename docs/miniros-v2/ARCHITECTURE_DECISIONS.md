# EP01 architecture decisions — adopted contract, limited implementation

Source EP00 checkpoint: `657a6c2`. These decisions adopt PRODUCT_AND_ARCHITECTURE.md
in full. They authorize a development walkthrough and conceptual interfaces; they do
not establish native, cloud or recovery readiness. Changes require a rationale,
updated dependent acceptance evidence and independent review.

## ADR-01 — owner web and native staff

Retain Next.js owner web, Expo/React Native staff prototype, shared TypeScript and
Supabase/Postgres services. Preserve existing web staff flows during transition.
SQLite is the intended native storage adapter, gated by EP04 actual-engine/device
checks. No Capacitor addition, backend rewrite or pure-PWA mixed-phone promise.
EP02 must select and demonstrate maintained cross-platform peer transport with
Android/Android, iOS/iOS and both mixed role combinations. Nearby is only a candidate.
EP01 browser walkthrough is W evidence for navigation only, not D evidence.

## ADR-02 — one authoritative cashier

Cashier installation + owner-issued authority epoch is the only financial/stock
writer; prep submits authorized stable commands and reads operational projections.
Checklist editing belongs to cashier only. Cloud validates/projects received events,
not live competing balances. No automatic failover. Replacement requires owner
approval, freeze/reconciliation and new epoch; loss before any receipt remains loss
of unknown untransmitted work, never invented recovery. EP01 guards model these
boundaries; real issuance, validation, atomic claiming and keys belong to EP05/07.

## ADR-03 — four independent outcomes

Local atomic ledger/projection/delivery work commit defines Saved. Peer durable
receipt defines Received by prep; cloud transaction receipt defines Received by
server. Media upload/link jobs retry separately and never hold later financial
operations. Closed locally is separate from cloud completeness and owner review.
The EP00 observed proof stall remains a documented legacy defect for EP13; these
interfaces do not fix it. Background execution is best effort: foreground/launch/
reconnect and explicit retry resume delivery. No disk failure may produce Saved.

## ADR-04 — automatic frozen snapshot

Owner maintains catalog/recipes/units/packs/checklist once, schedules only date,
planned times, venue/address and staff. First successful connected preparation
creates one versioned snapshot for both staff phones; owner builds no package and
allocates no stock. Explicit pre-opening refresh preserves compatible drafts and
invalidates incompatible confirmations. After opening, no silent replacement.
Schedule revisions, device occurrence time and server receipt time stay separate.
The walkthrough assumes Asia/Manila and treats end earlier than start as next day;
EP06 must implement explicit business timezone/DST and revision validation.

## ADR-05 — shift-only opening observation

Staff counts physical stock and float. Blank, counted zero and Not brought are
distinct. All relevant opening lines resolved plus explicit review before seal.
After seal, use audited adjustments. Opening is neither purchase nor central debit;
checklist supplies neither sell nor consume inventory. Preserve separate warehouse
movements and never aggregate duplicated observations into central stock.
Integer minor-unit money and fixed-precision per-item stock atoms remain production
requirements; the EP01 quantity input is a conceptual nonnegative number preview,
not a stock reducer/unit conversion engine. EP03/09 own that implementation.
No silent overselling; refunds reverse money without guessing returned materials.

## ADR-06 — offline scoped grants

First enrollment needs connectivity and assignment authentication. Capabilities bind
tenant, shift, role, installation/key, authority epoch, snapshot, actions and reviewed
validity policy. Ordinary cloud token expiry pauses upload, not active authorized
local work. Planned closing time never locks checkout. Explicit revocation/account
switch isolates data and preserves evidence; offline immediate revocation cannot be
promised. EP05/07 must choose/verifiably enforce validity and revocation policy; no
client clock alone is trustworthy. Keep web origin/CSRF guards; native API is additive.
No service-role secrets or reusable owner tokens on staff/QR.

## ADR-07 — prep recovery privacy

Prep sees only operational data. A redundant financial mirror must be opaque,
encrypted and readable only by authorized recovery tooling (or a narrower model
explicitly reviewed/tested). Hiding UI is not authorization. No owner private key on
prep. No cryptographic primitive or key lifecycle selected in EP01; platform/library
choice and adversarial verification are gates in EP02/05/16/18. No hand-rolled crypto.
A visible last-replicated checkpoint bounds recovery; no unreplicated event invented.

## ADR-08 — QR recovery and receipt meaning

Normal sync and QR import reuse original operation IDs and authenticity evidence.
Verify tenant, schema, sizes, digest/authenticity, sequence and manifest; stage partial
multipart scans durably and resume before posting complete. Separate ledger from
media and declare missing attachments. Owner offline web recovery requires cached
page, camera preflight and durable import storage; untested support stays blocked.
Owner-device receipt is distinct from cloud receipt. Retain staff copy after either.
EP16 must measure realistic size/scan conditions and choose reviewed transfer/library
mechanisms; no arbitrary-payload single-QR promise or custom encryption accepted.

## ADR-09 — preservation and development boundary

EP01 route requires development mode AND MINIROS_V2_SKELETON=1. Middleware returns
404 otherwise; page independently checks its gate. It uses synthetic in-memory data
and bypasses normal device/PWA providers on this exact development route to avoid
opening/synchronizing legacy journals. Reload discards walkthrough state explicitly.
No migrations, database or API calls, new dependency or production workflow switch.
Existing brand tokens/colors/type/spacing are reused. Rollback removes dev route and
concept contract consumers; legacy readers/writers and schemaVersion:1 remain intact.

## ADR-10 — EP03–EP05 additive implementation boundary

The user authorized EP02 followed by EP03–EP05 in the current local checkout. Shared
v2 contracts use safe integer minor units and stock atoms, SHA-256 canonical bodies,
immutable snapshots and cashier-only contiguous journals. Server-authenticated
Ed25519 signatures cover the UTF-8 digest text. A digest alone grants no authority.
Native enrollment and protected private-key lifecycle remain EP07 work; current
SQLite repository authority/signature validation is a mandatory injected adapter.

Actual SQLite commits local journal/projection/tenders and two delivery references
atomically; peer and cloud receipts plus attachment jobs advance independently.
The financial peer outbox is scoped to the cashier repository and is not connected
to EP02's synthetic transport. No plaintext financial mirror is exposed to prep,
and no encrypted mirror/key lifecycle is claimed implemented. EP11/16 must complete
and independently verify that boundary before financial replication to prep.

Backend persistence extends the existing Next server through isolated native routes.
Raw v2 tables deny Data API access, including service_role, and are absent from
Realtime. Live Bearer getUser validation replaces cookie refresh only for the exact
native route prefix; legacy web CSRF and cookie handling stay unchanged. Both v1 and
v2 claim paths share the shift row lock. New native claims also update that row so
a waiting legacy REPEATABLE READ transaction cannot use a stale reservation view.
A rollback must retain those compatibility guards while any v2 authority exists.

The grant acceptance window is at most 24 hours using server receive time; neither
device timestamps nor scheduled closing time extend it. Expired/revoked new work is
retained in an authorized-scope incident. Current authorized identity and original
installation/signature proof can retrieve an already committed receipt after expiry.
Online-token loss alone does not erase or block authorized local persistence. Owner
recovery records an audited decision and retains original signatures and ordering;
it does not waive expired/revoked grants. Dedicated owner adjudication and EP16's
QR/package workflow remain future work. Stock-adjustment capability is excluded
until a verified owner-approval adapter exists.

New authority creation is default-off behind
`MINIROS_NATIVE_V2_NEW_SHIFTS_ENABLED=1`; existing receipt retrieval and replay remain
available when it is off. The registration API provides the persistence boundary;
it does not introduce an owner package-building workflow or replace EP07's automatic
staff preparation. No production rollout, complete POS, native runtime approval or
physical/hosted acceptance follows from these portable integration results.
