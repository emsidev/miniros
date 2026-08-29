# MINIROS Build Notes

## Assumptions & decisions

- The existing monorepo layout is authoritative: the Next.js application lives in
  `apps/web`, shared business rules in `packages/domain`, contracts in
  `packages/contracts`, and Drizzle schema in `packages/db`.
- `pnpm@10.2.1` through Corepack is the canonical package manager. The unrelated
  root `package-lock.json` was present before implementation and remains untracked.
- Money is stored and calculated as integer cents. Inventory quantities normalize
  to three decimals using half-away-from-zero rounding; recipe aggregation keeps
  six-decimal intermediate products and rounds once per inventory item.
- The active workspace is an HTTP-only, same-site cookie containing only a business
  UUID. Every server service revalidates the authenticated user, active membership,
  business status, and any required employee permission or shift assignment.
- Owner/admin authority comes from active business membership. Operational access
  comes independently from `canUsePos`, `canLogProduction`, and shift assignment.
- A deleted employee, product, or inventory-item key is restored when its email/SKU
  is created again in the same business. This preserves historical foreign keys and
  avoids soft-delete uniqueness lockouts.
- The location recommendation window is the latest three closed shifts (or all
  shifts when fewer exist). Exact break-even and no-data cases need review; a
  negative average is not worth renting again; a positive average also requires a
  strict profitable majority.
- Payment proof upload is a deliberate two-phase workflow because object storage
  cannot participate in the sale's PostgreSQL transaction. The server validates
  binary signature, MIME type, and size; derives
  `{businessId}/payments/{paymentId}/{fileId}.{ext}`; then atomically links file,
  payment, and audit rows. A database failure deletes the staged object. A process
  termination in the narrow interval after upload can leave an orphaned object.
- Platform SQL is kept as timestamped files directly in `supabase/migrations`
  because the Supabase CLI only applies that directory level. Drizzle metadata stays
  in `supabase/migrations/meta`.
- No RPC, stored procedure, or business-logic trigger was added. The empty project
  already contained `public.rls_auto_enable()`; the final migration revokes its
  execution from `PUBLIC`, `anon`, and `authenticated`.
- The visual system uses warm oat surfaces, near-black controls, chartreuse accents,
  Outfit typography, rounded cards, and a mobile bottom navigation.
- The existing `promo_rules.discount_value` column is retained for schema
  compatibility: fixed promos are stored as two-decimal peso values and converted
  to integer cents at POS calculation time; percentage promos are capped at 100% by
  the server action.

## Local setup

1. Enable the repository package manager: `corepack enable pnpm`.
2. Install dependencies: `corepack pnpm install --frozen-lockfile`.
3. Copy `apps/web/.env.example` to `apps/web/.env.local` (or export the variables) and
   provide the required values below.
4. Start the app: `corepack pnpm --filter @miniros/web dev`.
5. Open `http://localhost:3000`.

## Required environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (preferred) or
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` (legacy fallback)
- `SUPABASE_SECRET_KEY` (preferred) or
  `SUPABASE_SERVICE_ROLE_KEY` (legacy fallback)
- `DATABASE_URL`
- `NEXT_PUBLIC_APP_URL`

Only names are documented. Secrets must never be committed.

## Quality gates

Run from the repository root:

```bash
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm build
```

`db:generate` is also expected to report no schema drift:

```bash
corepack pnpm db:generate
```

## How to run the Phase 1 acceptance flow

1. Register an owner, create a business, and leave that browser signed in as admin.
2. In Admin, create an employee with a unique email, POS permission, a sellable
   product with price/cost, recipe inventory items, the product recipe, a location,
   and a scheduled shift assigned to the employee as operator.
3. Register/sign in as the employee in a separate browser profile. The email invite
   is claimed using case-insensitive exact equality.
4. On mobile width, open the assigned shift, enter opening inventory counts, and
   start it. Use POS to sell the recipe product with cash plus a non-cash payment;
   include a reference and upload a JPEG, PNG, WebP, or PDF proof no larger than
   3.5 MB.
5. Log production, submit either a cash deduction or inventory adjustment, then
   return to the admin session and approve it.
6. Return to the operator session, enter actual cash and closing inventory, review
   deductions, and submit closeout.
7. In Admin, verify the closed shift profit, dashboard totals, and Location
   Profitability recommendation.

Client-generated UUIDs are retained across failed retries for shift start, sale,
proof, production, requests, and closeout, so repeating a submission does not create
duplicate records.

## Phase 1 acceptance checklist

The public/auth surfaces were browser-smoked locally after a real production-style
CSS compile: landing, login, registration, and the protected `/admin` redirect all
rendered without console errors. The authenticated data flow was verified using the
prompt-authorized minimum of a file-by-file action/service/table trace; no test
credentials or direct database password were available for a destructive live flow.

|   # |    Result    | Evidence                                                                                                                                                                                                                                                                                                               |
| --: | :----------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   1 | PASS (trace) | `registerAction` calls Supabase Auth, `ensureProfile`, and exact-email invitation claim; login repeats profile/invite reconciliation.                                                                                                                                                                                  |
|   2 | PASS (trace) | `createBusinessAction` -> one transaction creating business, owner member, owner employee, and audit row, then sets the active cookie.                                                                                                                                                                                 |
|   3 | PASS (trace) | `switchBusinessAction` permits only an active, non-deleted membership/business; `requireActiveBusiness` scopes every setup, operation, and analytics service.                                                                                                                                                          |
|   4 | PASS (trace) | Employee admin UI/action/service creates an operator with `canUsePos`; email recreation restores the historical soft-deleted employee.                                                                                                                                                                                 |
|   5 | PASS (trace) | Product UI/action/service writes integer price and cost, supports edit/delete, and restores a reused deleted SKU.                                                                                                                                                                                                      |
|   6 | PASS (trace) | Inventory-item UI/action/service creates the recipe inputs with unit, type, unit cost, and stock tracking.                                                                                                                                                                                                             |
|   7 | PASS (trace) | Recipe dialog -> `replaceRecipeAction` -> transactional, business-scoped BOM validation/replacement.                                                                                                                                                                                                                   |
|   8 | PASS (trace) | Location UI/action/service creates a scoped selling booth and its inventory location.                                                                                                                                                                                                                                  |
|   9 | PASS (trace) | Shift UI/action/service validates location, assignments, schedule, safe combined costs, salary snapshots, and persists them atomically.                                                                                                                                                                                |
|  10 | PASS (trace) | Mobile start form -> `startAssignedShiftAction` -> assignment/permission checks, opening count event/lines, balances, shift start, and audit in one transaction.                                                                                                                                                       |
|  11 | PASS (trace) | POS supports search/cart/discount and exactly one or two payments; non-cash reference/proof UI -> sale transaction plus server-validated private proof upload.                                                                                                                                                         |
|  12 | PASS (trace) | `finalizeSale` snapshots product costs and calls recipe deduction logic to create sale ledger event/lines and update balances inside the sale transaction.                                                                                                                                                             |
|  13 | PASS (trace) | Production form -> `logShiftProductionAction` -> production log, recipe input event/lines, balances, and audit in one transaction.                                                                                                                                                                                     |
|  14 | PASS (trace) | Inventory workspace submits typed cash-deduction and inventory-adjustment requests with idempotent IDs.                                                                                                                                                                                                                |
|  15 | PASS (trace) | Admin approvals page calls scoped review actions; approved inventory changes create the ledger event/line and balance update in the same transaction.                                                                                                                                                                  |
|  16 | PASS (trace) | Closeout form captures actual cash, closing counts, notes, and confirmation before `submitShiftCloseoutAction`.                                                                                                                                                                                                        |
|  17 | PASS (trace) | Closeout transaction locks the shift, aggregates completed sales/payments and salary/rent/transport/approved/other costs, reconciles cash/inventory, writes profit summary, and closes shift/assignments.                                                                                                              |
|  18 | PASS (trace) | Admin shift detail and dashboard read the persisted profit summary and closed-shift metrics with business scoping.                                                                                                                                                                                                     |
|  19 | PASS (trace) | Location report supplies date filters, per-location revenue/cost/profit, trend, best/worst cards, and the latest-three recommendation.                                                                                                                                                                                 |
|  20 |     PASS     | Root typecheck, lint, 32 domain tests, production build, migration/schema check, browser smoke, and live Supabase policy audit are green. Live DB: 35/35 public tables use RLS, 60 public policies, three private proof policies, all 11 required Realtime tables, six migrations, and zero security-advisor findings. |

## Phase status

- Phase 0 — complete and committed: repository, package manager, test runner,
  deployment linkage, schema, policies, routes, and environment contracts audited;
  baseline gates repaired.
- Phase 1 — complete: canonical vertical slice implemented and verified as described
  above.
- Phase 2 — core depth complete: editable business settings, promo management with
  POS application, sales/payment/product reporting, production overview, simple
  stock receiving/transfers, and selective client Realtime refreshes are live.
  Deferred Phase 2 items are live offline queue synchronization, the remaining
  approval types, and the full Bettercup demo seed.
- Phase 3 — explicitly deferred: advanced promotion campaigns, full background sync
  and conflict resolution, and unnamed scope.

## Known gaps / next session

- Run the numbered acceptance flow above against a disposable Supabase account once
  a direct `DATABASE_URL` and test credentials are supplied; the current session
  performed the permitted full static trace plus live schema/policy checks.
- Add an orphan-object sweeper for the narrow payment-proof process-termination edge.
- Link/create a Vercel project and deploy. No `.vercel/project.json` exists in this
  checkout; the production build and environment contract are deployment-ready.
- Add live offline queue synchronization and conflict handling when the server-side
  sync endpoint and proof-blob handoff are finalized.
- Add a safe, authenticated Bettercup demo-data seed and complete the remaining
  sale-correction/refund/void approval workflows.
- The e2e workspace and most non-domain packages still use placeholder test scripts;
  the required domain math suite is covered and currently has 34 passing tests.
