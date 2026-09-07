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
