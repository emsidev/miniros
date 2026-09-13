# EP03 v2 contract handoff

Local checkout: `miniros`, branch `dev`, baseline `0056f316cf811f10f943d56c4c987b1642844938`. This additive contract is exposed as `@miniros/domain/v2` and re-exported by `@miniros/contracts/v2`. Version 1 parsers, journals and reducers retain their existing meaning.

## Frozen semantics

- Money is a safe integer in minor units. Stock is a safe integer in snapshot-defined atoms: g/ml use an explicit scale of 1, 10, 100 or 1000; pieces use scale 1. Input conversions must be exact; no rounded fractional atoms or pieces.
- A version 2 snapshot binds the business, shift, checklist version, catalog, recipes, prices, costs, modifier rules and pack conversions. SHA-256 covers canonical snapshot JSON. Hash verification and recursive freezing precede reduction. Prepared inventory is a leaf, so sale consumption does not repeat its earlier production usage.
- Canonical JSON sorts object keys, preserves array order, accepts only JSON with safe integer numbers, and rejects undefined, cycles and excessive depth. Wire envelopes/snapshots are bounded to 262,144 UTF-8 bytes. Recipe graph expansion is memoized and checked for cycles, depth and integer overflow.
- Canonical operations have stable UUIDs, scope, snapshot ID/hash, cashier installation, epoch, contiguous positive sequence, schema/protocol 2 and SHA-256 body digest. Ed25519 signatures cover the UTF-8 text of that digest. Digest checking is not authentication: the adapter must verify the signature against an authorized persisted installation grant.
- The canonical financial journal is cashier-only. Prep submits a separately signed stable command. The adapter supplies trusted `verifiedPrepCommands`; payload booleans alone do not establish that an order is unprepared. Stock adjustments similarly require `verifiedStockApprovals` bound to approval ID, operation ID, item and exact delta. Adapters must not construct this evidence from untrusted payload fields.
- Opening observations initialize booth stock only. Uncounted, explicit zero and Not brought remain distinct; opening requires complete resolved counts and explicit review. No purchase or central-stock deduction occurs.
- Sales consume frozen recipes/modifiers and retain tender minus change. Gross is before discounts; net sales are gross minus discounts minus refunds. Digital change is forbidden; tenders must exactly cover the discounted total. Refunds are bounded by the original payment method and do not return stock. Complimentary/remake usage consumes materials without paid revenue. Explicit verified unprepared returns restore the original consumption once.
- An identical canonical operation returns the existing state without effects. Reusing an ID with a changed body/digest fails. New operations require exactly lastSequence + 1. No operation can reopen a closed journal. Stable prep command retries cannot reverse Done.
- Closing verifies the journal digest before close, exact current totals, full count classifications, and explicit resolutions for New/Making orders. Actual cash may remain null and stock may remain uncounted; neither is converted to zero. Pending attachment IDs do not prevent durable close.

## Public entry points

`createV2Snapshot` / `verifyV2Snapshot`, `sealV2Operation` / `verifyV2Operation` / `decodeV2Operation`, `sealV2PrepCommand` / `verifyV2PrepCommand`, `canonicalV2`, `exactAtoms`, `packCountAtoms`, `consumeV2Lines`, `initialV2Projection`, `applyV2Operation`, `summaryV2`, and `journalDigestV2` are the shared implementation. All SHA-256 functions are injected to support native and Node runtimes. Reducer inputs are a verified snapshot, cached projection, envelope and trusted actor context; output is an immutable replacement projection. Failed reduction leaves the previous projection unchanged.

Draft schemas allow empty carts and partial opening counts. Packing answer IDs and count item IDs must be unique. A valid draft is not an opening seal, owner authorization, payment or financial journal event. Persistence must validate draft item/template references against the stored snapshot, use revision checks, and clear only the exact successfully committed draft revision.

## EP04/EP05 integration boundaries

EP04 must commit journal, projection, tender evidence and independent peer/cloud delivery references atomically; a saved receipt is returned only after durable commit. Drafts and queues are identity-scoped and must survive auth loss, write errors and restarts. Authentication gates upload; temporary loss of a visible online session does not erase offline evidence or a valid local shift capability.

EP05 extends the existing Next server services under additive native routes; it does not replace the legacy replay service or bypass web CSRF. Persist exact snapshots/envelopes and original receipts. Lock the shift authority while applying one contiguous operation. Effects, seals/manifests, high-water mark and original receipt share one transaction. Rejected/gap/conflict evidence must survive separately without advancing the high-water mark.

Online grant issuance requires active verified identity, same-business membership, assignment, role and exclusive cashier authority. The maximum grant validity is 24 hours, measured by server receive time; device occurredAt cannot extend it. New expired/revoked-grant submissions are quarantined in the caller's authorized scope, not silently applied or deleted. Already committed receipts remain historical evidence and can be retrieved after current identity authorization. Previously accepted prep commands remain historical evidence after later expiry. ADJUST_STOCK is excluded from issued capabilities until a dedicated owner approval adapter exists. Owner recovery import requires current same-business owner/admin authorization and an audited reason; importing does not bypass original digest/identity validation, deduplication or terminal-state rules. EP16 recovery UI/workflow is outside this scope.

No bearer token or server/service-role secret belongs in an envelope, diagnostic export, SQLite journal or client bundle. Hosted Auth/Storage/Realtime verification and physical native testing remain separate blocked gates.

Implementation gate follow-up: new backend authorities are disabled unless
`MINIROS_NATIVE_V2_NEW_SHIFTS_ENABLED=1`; existing journal receipts/replay are unaffected.
EP04's financial peer queue is cashier-only persistence and remains disconnected
from EP02's synthetic transport. Prep financial-mirror encryption and native secure
key/enrollment adapters are not claimed implemented by this contract.
