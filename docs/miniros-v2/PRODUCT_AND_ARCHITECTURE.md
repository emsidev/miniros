# Product and architecture contract

## 1. Binding product decisions

This contract replaces owner-prepared per-shift inventory/menu allocations in older planning documents. Preserve useful implementation, not obsolete workflow assumptions.

| Area | Required behavior |
|---|---|
| Owner business setup | Configure products, prices, variants/modifiers, recipes, prepared-stock items, inventory categories/units, and a reusable departure checklist. This is business-level maintenance, not repeated shift preparation. |
| Owner shift scheduling | Date, planned opening/closing times, venue/name/address, and assigned cashier/prep staff only. Validate the essentials without requiring a product picker, stock allocation, recipe setup, or checklist reconstruction. |
| Automatic readiness | On staff joining/preparing the scheduled shift while connected, generate and cache a versioned catalog/recipe/checklist/assignment snapshot automatically. “Prepared” describes application readiness, not owner labor. |
| Staff before departure | Confirm reusable requirements such as heater, gloves, utensils, and booth supplies. Missing critical items require resolution or a specifically authorized exception. |
| Staff opening | Record quantities physically present at the venue. Searchable categorized counting, partial-pack units, progress, and an Uncounted filter. Never interpret a blank as zero. |
| Cashier | Record sales/payments locally, update expected stock, and independently deliver orders to prep and records to the backend. |
| Prep | Durable New / Making / Done queue; simple controls, local acknowledgements, and recovery after disconnection. |
| Owner visibility | Show committed received data, its revision and last-contact time; clearly disclose stale or incomplete information. No claim of live totals while the booth cannot reach the backend. |
| Closing | Compute sales, tenders, usage, waste, and expected inventory; capture cash and physical stock counts; preserve discrepancies and unverified quantities. Close locally without requiring upload completion. |
| Recovery | Resumable upload, retained local evidence, and QR-based owner handover using the same operation IDs as normal sync. |

The pilot is one authoritative cashier and one prep phone per shift, with Android–Android, iOS–iOS, and mixed Android/iOS support subject to physical testing. The data model remains business/tenant isolated. Do not imply that the pilot proves concurrent booths sharing the same physical stock.

Installation and first enrollment require successful preparation before leaving connectivity. Do not promise first-ever installation, a missing catalog, or a previously unknown staff identity will work offline. Staff must have an offline-ready check before departure. A later internet outage must not block a prepared shift.

Out of the pilot: multiple simultaneous cashiers, automatic cashier failover, prep acting as a cloud relay, live cross-booth stock allocation, loyalty, purchasing, payroll, online ordering, advanced profitability, integrated payment settlement, printers, and broad accounting integrations. Keep existing historical/owner features accessible without redesigning them. Preserve existing tax/discount behavior where retained; do not claim new fiscal certification or legal compliance.

## 2. Workflow and state model

Use separate state machines rather than one overloaded status column. Names below are conceptual; map to existing contracts without duplicating them.

**Staff workflow:** Scheduled → Prepared on device → Packing → Departure ready → Opening count → Open → Closing draft → Closed locally. Scheduled cancellation is explicit. A reopened/corrected closed shift is a new audited revision, not rewriting its original closure. Planned end time is not an automatic checkout lock.

**Cloud completeness:** Not received / Receiving / In sync through sequence N / Gap or conflict / Final manifest fully received. A device may be closed locally while upload is pending.

**Owner review:** Not reviewed / Needs review / Reviewed. Missing attachment review must not hold up other financial records.

**Prep order state:** New → Making → Done; cancellation, partial preparation and undo require explicit validated transitions and retained history. A delayed Start must not undo a later accepted Done. For V1, whole-order completion is sufficient; split an order explicitly before partially refunding/returning physical stock rather than guessing item state.

**Checklist answer:** Unchecked / Packed / Missing / Authorized exception, with actor, time, template version and reason when applicable. Initial implementation has one checklist editor, the assigned cashier; prep can help physically and view the results. Do not create a second writable checklist master.

**Count line:** Uncounted / Counted(quantity) / Not brought. Counted zero remains distinct from Not brought. Relevant stock lines must be resolved before opening. A “mark remaining not brought” action needs an explicit count and confirmation. Actual closing counts may remain unverified under the recorded policy.

The departure checklist confirms readiness. It neither creates equipment sales inventory nor deducts consumables. Opening counts initialize only the booth's shift stock ledger. They are not purchases and do not automatically debit central stock. Existing warehouse/location tracking must retain its separate movements; never sum duplicated opening observations into business stock. Central transfers require explicit source/destination records in a later or existing supported workflow.

## 3. Counting and staff interface

Use one search field, a compact category picker/chip row, progress per category, and an Uncounted filter. Avoid a long row of scrolling tabs, repeated form pages, or a full administration dashboard on staff phones. Show likely relevant items from the automatic catalog snapshot; staff may mark items Not brought and hide unavailable menu products. No routine per-shift owner product selection.

For counts, support owner-defined pack sizes plus base quantities: e.g., three sealed 1-litre cartons plus 400 ml = 3,400 ml. Store explicit units and conversions. Do not assume density, grams-per-scoop, or pack contents without configuration. Reject negatives, NaN, infinity, incompatible dimensions, and fractional pieces where disallowed. A changed conversion must not alter an already-issued shift snapshot.

Autosave each change durably with an honest Saving/Saved/Error state. Preserve current text if parsing or storage fails. Reopening must restore the last successful draft, category/filter and unresolved validation state. Provide a final review before sealing opening counts. After opening, corrections are adjustment events, not edits to the original count.

Cashier: product grid/list with search, cart, modifiers, cash/manual digital/split tenders as supported, clear total and change, one confirm action. Prep: readable queue, order number, contents/modifiers, elapsed time, primary state action. Keep connection issues understandable. Do not expose sequence numbers, “outbox,” or transport jargon in the ordinary workflow.

Design for the supported phone widths, large touch targets (project target at least 48 logical pixels), readable totals, screen-reader labels, text scaling, reduced motion and optional sound/haptics. Never convey an error only through color. Use existing Miniros branding/design tokens; Bettercup is a fixture/pilot business, not a reason to rebrand the whole platform. Visual review uses the running implementation, not only screenshots of static mockups.

## 4. Working architecture and reuse boundary

Retain Next.js for the owner web app, Expo/React Native as the staff prototype, TypeScript domain/contracts, and Supabase/Postgres behind authorized server services. Adapt storage and identity deliberately. Do not create a second repository, replace the backend wholesale, add Capacitor alongside Expo, or move business rules into React components or ad hoc Supabase RPCs merely to simplify a screen. The current README places business logic in shared packages and server services [R2].

Use native SQLite for the new staff ledger, subject to real-device tests [S3]. Keep the old Dexie data intact and drain/reconcile it during migration; a browser database is not automatically accessible to a native app. The transport spike chooses a maintained native cross-platform link implementation. Nearby Connections is a candidate, not an approved dependency or proven result [S4]. Do not use internet WebSockets/Supabase as the hidden implementation of an “offline” prep link. Do not claim a pure PWA meets this requirement without physical evidence.

Keep four independent paths:

1. Local command → atomic ledger/projection/outbox commit → saved UI response.
2. Durable peer delivery → prep saves order → peer receipt; prep commands travel back separately.
3. Durable financial-record upload → backend transaction → server receipt → owner queries.
4. Attachment upload/linking → independent retry and review status.

Both outboxes may reference the same immutable operation but have separate delivery receipts. A failed photo cannot block later sales. A failed cloud path cannot block local prep. A failed peer path cannot block local sale commitment. Disk failure is different: never report a saved sale after a failed disk transaction.

Background execution is best effort, not a mobile-OS guarantee. Resume queues on launch/foreground/reconnect, offer explicit retry, and keep the operational display foregrounded when in use. Screen locking may delay live prep delivery; reconnect/readback must make that visible rather than fabricate a receipt.

## 5. Data authority and event contract

The cashier is the sole writer of the authoritative financial/stock journal for the active shift. Owner master changes apply to future snapshots. Prep sends stable, authorized commands; the cashier records accepted transitions into canonical history. The cloud validates and projects received journal operations; it does not compete with the cashier to mutate live stock balances.

An operation envelope includes business ID, shift ID, protocol/schema version, snapshot ID/hash, origin installation/device ID, cashier authority epoch, stable operation ID, per-authority sequence, operation kind, device occurrence time, payload, and canonical digest/authenticity evidence. Server receipt time is separate. IDs establish uniqueness, not trusted wall-clock order. Use standard authenticated transport and reviewed cryptographic libraries; a checksum alone is not authorization.

Transactions persist the immutable operation, monetary/tender effects, stock movements, local projection, and delivery work atomically. Receivers persist operations/commands before acknowledging them. Same ID + same canonical payload returns the prior outcome; same ID + different payload is a visible conflict. Delivery is at-least-once; applied effects are deduplicated. Do not advertise a magical exactly-once network.

Maintain a contiguous accepted sequence/high-water mark plus gap information. An invalid record blocks that shift's final completeness until resolved; it must not stall unrelated businesses/shifts. Keep raw rejected evidence in quarantine for review rather than silently discarding it or skipping gaps. Server retry after commit but before acknowledgement must reproduce the original receipt.

Conceptual entities (reuse existing equivalents): business catalogs and versions; inventory items/categories/pack conversions; recipes/modifiers; checklist templates/entries; scheduled shifts/assignments; installations/device keys; scoped shift grants; snapshots; checklist responses; opening-count drafts/seal; immutable operations; orders/lines/tenders; stock movements; peer inbox/outbox/receipts; cloud receipts; attachment jobs; closing manifests/counts; owner reviews/corrections. Every relevant row is tenant scoped, and relationship constraints prevent mixing shifts/businesses.

Money is integer minor units, with explicit allocation/rounding for split tenders and discounts. Stock uses fixed-precision integer atoms with item-specific base units/scales. Share the tested reducer/math across local and server projections where practical. Freeze recipe, price, pack and costing versions for the shift; no recomputing historical consumption with a newer recipe.

## 6. Inventory and financial semantics

Expected stock = opening + restocks + explicit physical returns + approved adjustments − sold recipe usage − complimentary usage − remake usage − waste. A prepared-item recipe consumes that item's portions and toppings; it must not consume raw ingredients again if production already did so. Recipe dependency cycles and invalid conversions block catalog readiness.

Commit recipe consumption at confirmed sale in V1, including packaging/modifiers. Refunds reverse money, not automatically materials. Cancellation before preparation may restore reserved stock only through an explicit unprepared-return event and resolved prep acknowledgement/physical confirmation; while preparation state is uncertain, do not assume stock returned. A remake consumes another recipe without duplicating paid sales. Complimentary/staff drinks consume stock without inflating revenue. Keep audit reasons and actor permissions.

Preserve the existing no-overselling invariant by default. Insufficient stock blocks that item/transaction, not unrelated available products. A count correction/restock must be recorded explicitly before retry. Do not auto-adjust stock upward to make checkout pass, or introduce unapproved oversell overrides. Refunds cannot exceed the original retained tender amount; void/cancel retries must not return money twice.

Opening cash float is staff-entered at opening, not an extra owner scheduling task. Expected cash = float + retained cash sales + paid-ins − cash refunds − paid-outs. Cash tendered minus change, not cash handed over before change, contributes to retained sales. GCash/Maya/manual digital entries record staff confirmation; they do not process or independently verify external payment settlement.

## 7. Enrollment, security and recovery limits

Use current owner/business authorization for scheduling/configuration. Before departure, staff identity and assignment are authenticated and the installation receives a narrowly scoped shift capability. Grant issuance binds business, shift, role, origin installation/key, authority epoch, snapshot, allowable actions and a documented validity policy. Enrollment, refresh, export and import require tenant/role checks. A join QR is not a reusable owner token.

Freeze automatically when the first staff preparation succeeds, with both devices on the same snapshot. Refresh may be explicit before opening, preserving compatible drafts and invalidating incompatible confirmations transparently. After opening, silent catalog/checklist replacement is forbidden. A remote schedule/assignment change during an outage cannot be instantly known locally; record revisions and show them at the next contact.

Ordinary cloud-token expiry pauses uploading, not an already-authorized local shift or its records. Offline grants have a separate reviewed policy that does not hard-stop an active shift at its planned closing time. Explicit revocation/account switch is different: isolate local business data, preserve evidence, and enforce the policy on reconnection. Immediate offline revocation is impossible; do not claim it. Old or suspicious grants/events remain auditable and may be quarantined rather than silently lost. Do not trust a user-editable clock alone to prove authorization at occurrence time.

Never ship Supabase secret/service-role keys in staff builds or QR payloads. Protect exposed tables, views, storage and realtime channels with grants and RLS, and validate tenant/role/device at server mutation boundaries [S6]. Preserve existing web CSRF protections while adding an authorized native API adapter. Do not solve native authentication by turning off origin checks globally.

The prep phone has only its authorized operational data. For redundant financial recovery, store an encrypted opaque recovery mirror readable through authorized owner/recovery tooling, or explicitly document and test a narrower reviewed access model. Hiding a revenue screen is not a security boundary for readable financial rows. No owner private key belongs on prep. Use reviewed platform/library mechanisms, not custom cryptography. Keep a visible last-replicated checkpoint; recovery cannot invent operations not yet copied.

No automatic cashier promotion on connection loss. A controlled replacement requires owner authorization and a new authority epoch after a documented freeze/reconciliation procedure; if that cannot be established offline, remain in explicit manual fallback and leave recovery provisional. Losing every device before any external receipt loses untransmitted records.

## 8. Cloud and closing completeness

Use Supabase Realtime as an invalidation signal, not the ledger itself [S5]. Query authoritative summaries on first load, resubscription, foreground return and bounded periodic reconciliation. Show last received revision, last contact, stale state, and attachment/review status separately. Do not claim to know the number or value of unsent operations while the booth is unreachable.

A closing manifest identifies the shift/snapshot/authority, last financial sequence, digest, pending attachments, expected balances, actual count statuses, and closing time. Backend “fully received” requires all records through that boundary and matching results. Owner corrections are new records/revisions. Local closing succeeds without internet; unresolved prep orders require an explicit completed/cancelled/manual-resolution choice, not silent deletion.

QR recovery may require animated multipart transfer. Normal uploads and QR import use the same original operation identities and authorization evidence, including when only part of a shift has already synced. Verify integrity/authenticity, tenant, schema, size and sequence boundaries. Resume partial scans in a staging area; post nothing as complete until verified and durably committed.

To support an offline owner handover on the retained web app, build a deliberately cached recovery page with local durable import storage and camera permission preflight. A locally saved receipt means “received on owner's device”; it is NOT a cloud receipt. A later server receipt proves cloud commitment. The staff retains its copy after either receipt. If owner offline storage/camera support is not validated, report that gate blocked rather than presenting an online-only importer as offline recovery.

Separate small essential ledger transfer from large media; missing photos remain declared pending. Never delete unsent media to claim a complete transfer. Test realistic package size before promising QR capacity or transfer performance. Retention and cleanup require explicit policy, confirmed receipts, and privacy review; no automatic purge of an unreceived shift.
