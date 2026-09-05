# Schedule

`/schedule` is the active business's published shift calendar. It defaults to today in Asia/Manila, shows a selected-day agenda alongside the month on desktop and below it on mobile, and supports Previous, Next, Today, arrow keys, Home/End, and Page Up/Page Down. My shifts remains the personal operational workspace. Production-only employees retain their existing route restrictions.

The calendar service returns only identity, date, title, location, lifecycle, personal assignment status, and server-derived eligibility. Draft, cancelled, and deleted shifts are excluded. Assignment checks continue to protect operational workspaces. The `centralized_schedule` migration adds employee discovery of published shift rows without changing assignment, cost, sale, or write policies. Apply this migration through the normal migration process when deploying.

Joining requires connectivity and immediately saves an assigned assignment. The action accepts only a UUID shift ID. The service resolves and rechecks the active business membership and employee, snapshots the default shift rate and POS-dependent role, and reactivates an existing cancelled assignment. A scheduled shift must be dated today or later, have no actual start or elapsed scheduled start, and have no offline-device reservation. Assigned, confirmed, and completed assignments on another published, non-deleted shift on the same date block joining.

Joins and admin create/update/bulk workflows acquire a business-scoped transaction advisory lock **before** taking shift or employee row locks. This serializes scheduling decisions, including changes to other shifts' dates and assignments. The join rechecks eligibility after locking, writes the assignment and audit event transactionally, and increments the existing timestamp version so an older admin form cannot overwrite it. Duplicate joins return the existing assignment without changing pay/status or adding audit events. Start and offline preparation continue to coordinate through the existing shift row lock.

## Verification

Run the focused calendar tests and in-memory PostgreSQL workflow/RLS tests:

```sh
pnpm --filter @miniros/web exec vitest run src/lib/schedule.test.ts src/lib/shift-planning.test.ts src/components/employee/shift-presentation.test.ts src/server/services/schedule.db.test.ts
pnpm --filter @miniros/web typecheck
```

For real concurrent sessions, set `SHIFT_TEST_DATABASE_URL` to a disposable PostgreSQL database with the migrations applied, then run:

```sh
pnpm --filter @miniros/web exec vitest run src/server/services/schedule.db.test.ts src/server/services/admin-shift-workflows.db.test.ts
```

The concurrency cases create random fixtures and remove them in `finally`; the other cases roll back their fixtures. They cover competing joins, duplicate requests, admin waits/stale edits, and conflicts introduced by admin date changes.

Browser verification of the actual ScheduleCalendar component with fixture data covered 375px, desktop, landscape, reduced motion, visible keyboard focus, month navigation, empty dates, assigned workflow links, pending/error feedback, and immediate conflict updates after joining. Server behavior is verified separately by the database tests.
