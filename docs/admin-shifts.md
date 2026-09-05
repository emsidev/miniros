# Admin shift planning

`/admin/shifts` provides the open agenda, weekly calendar, history, URL-based filters, and reviewed bulk actions. Creation lives at `/admin/shifts/new`; edits use `/admin/shifts/[shiftId]/edit`. Both share the location/date, team, and planned-cost sections.

Drafts may be unstaffed. Publication validates the location, active staff, and POS permission, then schedules the shift and assigns its team in one transaction. Employee services and database SELECT policies independently exclude drafts. Assignment policies filter assignment statuses directly to preserve the existing non-recursive policy graph.

Apply these migrations in order, as separate committed migrations, before deploying code that creates drafts:

1. `20260905022136_shift_draft_statuses.sql`
2. `20260905022223_shift_draft_privacy.sql`

Edits and bulk actions lock the shifts in ID order and compare their saved `updatedAt` versions. Bulk operations validate every affected plan before mutation, then commit together. Creation uses a business-scoped request ID and payload fingerprint for safe retries. Batched inserts and updates keep date ranges from generating one full workflow per date.

Pay and itemized costs remain snapshots. Removed assignments are retained as cancelled and excluded from planned totals. Finalized closeout records are read without alteration; an absent profit summary stays distinct from a persisted zero.

## Verification

Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm --filter @miniros/web build` from the repository root.

Database tests are opt-in. Set `SHIFT_TEST_DATABASE_URL` to a database with the migrations applied, then run:

```sh
pnpm --filter @miniros/web exec vitest run src/server/services/admin-shift-workflows.db.test.ts
```

The database suite creates random fixture identities and businesses. Cases roll back their writes; the concurrency case commits an isolated fixture and deletes it in `finally`. It checks employee services and RLS, retries, publication, snapshot preservation, team replacement, stale edits, concurrent row locks, and transaction rollback. No operational shift IDs are used.

Browser regression checks cover single and multiple dates, unstaffed drafts, publication errors, linked field errors, retained input after realtime refresh, cost overrides, bulk review, history/back navigation, missing versus zero profit, and layouts at 360, 768, 1024, and 1440 pixels.
