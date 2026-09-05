# Automatic offline shifts

## Operating journey

Create account → create business → add products and costs → configure location/team → schedule and assign shift → open Start shift online → automatic device preparation → opening counts/start → sales and requests → counted closeout → synchronize and review → final location profit.

The owner dashboard derives setup progress from current records. Forms and permissions are shared with the existing application. The operator’s shift page, POS, start and close routes direct the owning device to its prepared workspace when a reservation exists. Server receipts are available under `/shifts/[shiftId]/sales` with pagination; local and pending receipts are under `/offline` or `/sync`. Installation and synchronization help is available through the compact This device controls. The existing `/help` redirect to Shifts is preserved; installation guidance explains automatic preparation and the owner/admin Devices page.

The Astro early-access CTA now opens the web app’s registration page instead of submitting a form with no handler. Set `PUBLIC_APP_URL` on the site deployment to the actual web-app origin; its local default is `http://localhost:3000`. This creates an early-access account, not an email waitlist or an automatic invitation promise.

## Installation and preparation

Production builds generate `/sw.js` and `/pwa-assets.json` after `next build`. The manifest has stable identity/scope, standalone display, PNG 192/512 icons, a maskable icon and Apple touch icon. The Install page offers a captured native install prompt when available, Safari Share → Add to Home Screen instructions, and hides installation instructions when already running standalone. Zoom remains enabled.

The worker caches only the public `/offline` HTML shell, manifest/icon and versioned static chunks/fonts. It does not cache authenticated HTML or API responses. Failed operational navigations and the installed root URL fall back to the shell. Readiness checks every required cached resource. Old static caches are retained to avoid breaking older running tabs; they are not an archive of private pages. Updates are offered only after local work and drafts have cleared. Background Sync is not required: launch, foreground return, connectivity changes, timed foreground retries and manual retry drive synchronization.

Opening Start shift automatically verifies the production shell, calls the authenticated preparation service, and atomically persists the snapshot in IndexedDB. No separate download button is needed. The device shows “Offline ready” only after verifying app files and local data, then presents opening counts and review. Counts, notes, review progress, and request identifiers survive reloads. A failed save blocks starting and offers Retry; there is no online-only fallback. Retry on the original account/browser if the server reserved the shift but the local write failed. Durable storage is requested where supported; browsers or users can still erase it. Use the same installed app/browser storage container to start and operate. In particular, install on iOS first and open Start shift inside that installed app; do not assume Safari and an installed app share their local records.

The server snapshot includes the account/business/operator, shift/location, inventory count scope, sellable products, prices/costs, recipe quantities, production-output stock linkage, enabled discounts/promos and scheduled shift costs/salaries. Preparation validates stock dependencies. Stock counting follows the existing workflow’s 1–500 tracked-item requirement. Central production, receiving, transfers, administration and approvals remain online.

## Ownership and authorization

All existing and future locations support offline shifts automatically. The legacy `offline_pilots` table is retained for compatibility but no longer controls preparation, and Settings has no offline enablement controls. Preparation reserves only the shift whose Start shift page the operator opens, never every assignment at sign-in. Server rendering and link prefetching cannot reserve a shift. Fresh online-only starts are rejected; historical opening retries remain idempotent. Already-started online shifts finish through their existing flow, and existing prepared sessions retain their ownership and records.

An HTTP-only, SameSite installation cookie is hashed; a separate UUID is durably stored in the browser’s IndexedDB container and sent in `x-miniros-storage`. Both are bound to `offline_shift_sessions`. Copying cookies into an installed app with a different storage container does not transfer its prepared shift. A partial unique index permits one unreleased session per business/shift. Shift row locks serialize preparation and operational writes. The normal start/sale/request/closeout and shift maintenance/stock services reject reserved shifts. Proof linking checks device ownership too. Disconnects and elapsed time never release ownership.

Each request rechecks authenticated business access, POS permission and assignment. The status endpoint verifies current access before exposing prepared snapshots. Local reads are partitioned by user/business/device; online account mismatches remove the visible identity while preserving saved records. A signed-in browser is not an encrypted vault: normal device/browser security still protects offline storage.

Sign-out and business switching guard pending preparations, checkout drafts and attachments. An unused preparation can be released online by its original device. The UI rejects release once any local action exists. Once a shift starts, finish and synchronize closeout before routine transfer.

The owner/admin Devices page (`/admin/devices`) lists current device–shift assignments across locations, prioritizes sessions needing attention, and shows only server-acknowledged activity. Each assignment opens a linked dialog (`?session=…`) with readable activity, collapsed technical details, and freeze/restore actions requiring an audit note. A disconnected device receives a freeze on reconnect; it is not a remote erasure. **Permanently lost local data cannot be reconstructed automatically.** Such a shift remains reserved/unresolved and excluded from final location results until original records can be reconciled. Only the original device can be restored; recovery never silently transfers ownership.

## Durability and replay

`packages/contracts` owns the shared Zod operation/envelope contracts and pure prepared-sale projections. Operations are opening/start, sale with proof declarations, cash request, inventory adjustment request and closeout. Each envelope records immutable action/session/snapshot IDs, schema version, sequence and original occurrence time.

The new `miniros-prepared-shifts` Dexie database stores sessions, drafts, actions, local projections, receipts/results, proof blobs and identity/synchronization metadata. A single IndexedDB transaction saves each action, proofs, local effects and next sequence before success is shown. Competing tabs serialize through this transaction and a synchronization lease. Positive adjustment requests never increase sellable stock; negative requests conservatively reduce the local projection. Offline closeout seals local selling immediately and remains provisional.

The former unused `miniros-offline` scaffold is retained as a read-only legacy archive. Its payloads lack device/session/snapshot guarantees and are never replayed as new operations. No legacy database is silently deleted.

`POST /api/offline/sync` validates ordered envelopes and applies them through the existing services with an internal prepared context. Business effects and the digest/result journal commit in one Drizzle transaction. Identical repeats return the original acknowledged result, including after closeout. Changed payloads or reused entity IDs conflict. A savepoint rolls back a rejected operation; structured conflicts and originals are preserved for review. Transient failures retry. Dependency conflicts stop automatic replay until explicitly retried after review.

Sales use the stored catalogue/recipes/costs; current prices cannot silently reprice them. Working start/sale/payment/closeout timestamps come from the original envelope. Clock/order inconsistencies conflict instead of being silently rewritten.

A closeout intent is immutable once received. It sets server state to closing, waits for every earlier action and every pending cash/inventory review, and verifies declared proof links. No final profit summary is created until that barrier clears. Final closeout uses prepared shift costs and approved deductions, acknowledges closure, completes assignments and releases ownership. The device displays the server-confirmed cash difference and profit separately from its original estimates.

Proofs use private Supabase Storage, existing signature/size validation and content-addressed object paths. Retry can verify an already uploaded object and finish its database link after a lost acknowledgement. Proof errors remain visible locally. Unlinked uploaded objects are preserved for retry rather than deleted in a way that could race a successful link; a future orphan-retention cleanup needs to respect pending sessions.

## HTTP surfaces

| Endpoint                              | Purpose                                                                       |
| ------------------------------------- | ----------------------------------------------------------------------------- |
| `POST /api/offline/prepare`           | Reserve a scheduled shift and return its authoritative snapshot.              |
| `GET /api/offline/status`             | Revalidate the account/device and return permitted session status.            |
| `POST /api/offline/sync`              | Apply one ordered operation, or return its original acknowledgement/conflict. |
| `POST /api/offline/proof`             | Upload/link a declared proof through the existing service.                    |
| `GET /api/offline/recovery?session=…` | Owner/admin journal inspection.                                               |

Mutation routes enforce same origin. Responses are not cached. New tables enable RLS and grant no direct browser access; operational services perform server authorization. The browser role cannot write the journal.

## Deployment and release gate

1. Apply the repository’s pending migrations in order on a staging database, including `20260905040950_offline_shift_sessions.sql`, before deploying the new server. The migration was exercised on a disposable PostgreSQL engine; no hosted database migration was applied by this implementation task.
2. Build using the package build command so the worker and asset list are emitted. Serve HTTPS outside localhost, keep the worker/asset-list response uncached, and configure `PUBLIC_APP_URL` for marketing links.
3. Use disposable staging business data for the acceptance matrix in `offline-acceptance.md`. Do not use real customer transactions as fixtures.
4. Complete the physical Android/iPhone and reconciliation acceptance matrix before production release. Offline support applies to every location automatically; there is no pilot toggle. Run browser offline checks against a production PWA build, because development mode intentionally does not install the service worker.

Guidance: [Web app installation](https://web.dev/learn/pwa/installation), [Apple Add to Home Screen](https://support.apple.com/en-in/guide/iphone/iphea86e5236/ios), [Background Sync browser support](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API).
