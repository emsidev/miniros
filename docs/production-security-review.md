# Production verification and remediation — 5 September 2026

The repository security review identified seven security findings and applied fixes in the working tree. This document records remediation and release verification; the [sealed Codex Security report](security-scan-2026-09-05/report.md) contains the original findings and source evidence. Nothing was pushed, deployed, or applied to the hosted database. The security workbench retains the original scan target and warns that the working tree changed during remediation; the release checks below cover the final source copy.

## Changes

| Area              | Result                                                                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tenant boundaries | An additive migration removes direct browser setup writes that could attach another business's IDs. Server transactions remain the supported write path.                 |
| Sales history     | Assigned employees also need POS permission to read sales and payment references. The navigation link follows the same permission.                                       |
| Proof uploads     | Authentication runs before multipart parsing. The complete request is limited to 4 MB, including extra fields; proof services retain their 3.5 MB file/signature checks. |
| Invitations       | An email must be confirmed before invitation claiming. Registration without a session cannot create membership/profile side effects.                                     |
| Storage           | Legacy unlinked proof upload/update policies are removed. Exact linked-proof reads and validated server uploads remain.                                                  |
| Shift planning    | Staff/cost arrays and expanded multi-date row counts have explicit limits before allocation and SQL insertion.                                                           |
| Dependencies      | Patched Next.js, Hono, Astro and compatible transitive packages; upgraded the Expo scaffold and replaced vulnerable build tooling.                                       |

Workflow fixes cover manual discounts with saved promotions disabled, declared proof identity and upload races, uppercase proof UUIDs, required review before closeout, reviewing existing requests when approvals are disabled, and letting owners reject stale adjustment requests after an item is deactivated/deleted. Prepared inventory adjustments also retain their verified snapshot item after catalog deactivation/deletion: they queue for review without changing stock, current approval checks stay strict, and an owner can reject them so closeout can finish. Online checkout state now resets when its user/business/shift changes. Automatic sync polling survives transient errors and overlapping resume events. Build caching includes generated PWA artifacts, and integration test environment variables reach the test runner.

The pre-existing working tree and the concurrent **Explain offline shift settings** task were preserved. Automatic preparation and the Devices page belong to that task; their new code was included in follow-up review and verification where available.

## Dependency status

The dated audit fell from **84 alerts to 2 moderate tooling alerts**, with **zero web-runtime alerts**. Remaining paths are Drizzle Kit's esbuild loader and Expo/xcode's UUID dependency. The observed consumers do not call the vulnerable APIs, and no stable parent upgrade removes these alerts. They remain visible in the audit; no ignore rule or incompatible forced major upgrade was added. See [dependency-security.md](dependency-security.md) for exact versions, applicability evidence, platform changes and primary sources.

Builds now require the Node versions declared in the root manifest; verification uses Node 24.19.0. Expo's dependency alignment, Doctor (21/21), TypeScript/lint, web export, and iOS/Android Hermes exports passed. Native compilation and physical-device execution were not performed.

## Verification

The final isolated verification passed:

- Frozen pnpm install; full production build, TypeScript and lint: **11/11 workspace tasks** each.
- Full test suite with database and HTTP tests enabled: **244 reported test executions, zero skipped** (53 domain, 1 contracts, 145 web, 45 E2E; shared tests execute in both web and E2E).
- Real PostgreSQL integration includes 21 administration/scheduling checks, including transaction-concurrency cases. Security regressions also exercise actual RLS/service boundaries in PGlite, bounded uploads, invitations, POS authorization, proof races, offline replay and sync retry behavior.
- The built app passed its four production HTTP checks. A browser smoke check rendered the offline shell, reached the login page, and recorded no console errors. Authenticated browser acceptance remains a staging task.
- A real Turbo cache hit restored both generated PWA files with identical hashes (all 6 relevant build tasks cached).
- All 477 source/configuration fingerprints matched the final working tree, accounting for a final three-line indentation-only test edit. The eight final review/fix deltas were included in the passing integrated checks. The source copy excludes local secrets and build output, preventing concurrent development artifacts from affecting the result.

The isolated copy uses the frozen pnpm lockfile and synthetic local service settings; it contains no hosted credentials. Tests use disposable PostgreSQL 18 with the complete SQL migration chain and minimal Auth/Storage schema fixtures, plus PGlite and fake IndexedDB. This verifies database constraints, RLS and real transaction locking; it does not substitute for hosted Auth/Storage HTTP acceptance.

## Before deployment

1. Apply `supabase/migrations/20260905071237_security_server_write_boundaries.sql` through the normal reviewed migration deployment. Local tests do not change hosted policies. These permission changes prevent new invalid links; they do not repair any cross-tenant references already stored, so existing data needs a read-only integrity check before release. Repository clients use server transactions; direct browser setup DML is deliberately no longer supported.
2. Verify the target Supabase project's email-confirmation behavior, OAuth/reset redirect allowlist, private proof bucket and server-only credentials. Hosted configuration was not inspected or changed. The invitation fix relies on the provider accurately reporting confirmed email ownership.
3. Set the marketing site's `PUBLIC_APP_URL` to the real HTTPS app origin. Its documented local default is localhost. Confirm reverse-proxy forwarded host/protocol sanitization and production ingress limits.
4. Run the production acceptance flow with isolated staging accounts: registration/confirmation, role changes, two-tenant access, proof upload/read, device preparation, offline cold launch, sale/proof retry, owner review and final closeout reconciliation. Test the actual supported phones/browsers and storage persistence.
5. Re-run checks if the concurrent task or any other source changes after the recorded verification snapshot. Native app release additionally needs actual native builds/device tests.

Static source coverage includes application/server/UI source, contracts/domain/database schema, executable SQL migrations and build configuration. Generated metadata, dependencies/build output, artwork/static styling and bundled agent skill instructions are excluded from manual source review; dependency trees and generated build behavior were checked separately. Some test bodies were executed without exhaustive manual inspection. No live attack, production load test, penetration test of infrastructure, or hosted-data migration was performed. TAC authorization could not be verified because its connector was not signed in.

Measured Codex Security usage across four tasks: 60,273,395 total tokens, comprising 60,085,543 input tokens (58,503,296 cached) and 187,852 output tokens. The tool reports complete measurement; these are token counts, not a price estimate.

Canonical artifacts, copied unchanged after successful sealing: [manifest](security-scan-2026-09-05/scan-manifest.json), [findings](security-scan-2026-09-05/findings.json), [coverage](security-scan-2026-09-05/coverage.json).
