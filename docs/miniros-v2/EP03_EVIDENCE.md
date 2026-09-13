# EP03 evidence — shared v2 contracts and arithmetic

Local `dev` checkout at baseline `0056f316cf811f10f943d56c4c987b1642844938` plus this uncommitted diff, 7 September 2026. EP03's unit/contract gate is accepted independently. This does not accept EP02's native/device gate.

The versioned API is documented in EP03_CONTRACTS.md. Existing v1 exports and journals retain their original parser/reducer. New pure v2 contracts cover snapshots, counts/drafts, signed operations and prep commands, exact minor-unit money/stock atoms, and all 12 journal operations. Opening observations initialize booth stock without central-stock mutations. Frozen snapshots retain historical recipe, modifier, pack and price semantics.

## Commands and results

- `corepack pnpm --filter @miniros/domain --filter @miniros/contracts typecheck`: passed.
- Same filters with `lint`: passed.
- Same filters with `test`: **domain 110 passed, contracts 143 passed; zero failures/skips**. Raw output: `evidence/ep03-tests.log`.
- Independent reviewer owns 35 domain and 37 contract tests (72 total), plus strict standalone test TypeScript and lint checks. See EP03_REVIEW_REPORT.md. Reducer author owns 22 focused tests and EP03_REDUCER_REPORT.md.

The independently entered oracle verifies gross sales 67,000, discounts zero, refunds 15,000, net sales **52,000**, net cash 40,000, manual digital 12,000, and expected cash **240,000** minor units. Expected stock atoms are matcha 976,000; milk 9,900,000; ube 2,880,000; cups 93; lids 94; straws 94; cookie portions 5; ice cream 920,000; spoons 19. Original `fixtures/golden-shift.json` was not changed.

## Acceptance mapping

| ID       | U result and independent evidence                                                                                                           |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| EP03-T01 | Passed: entire golden scenario and exact literal financial/stock constants.                                                                 |
| EP03-T02 | Passed: every operation replayed twice, refund/remake retries, stable prep commands and changed-ID/body conflicts.                          |
| EP03-T03 | Passed: mutate caller-owned master prices/recipes/packs after snapshot; historical values and usage remain frozen.                          |
| EP03-T04 | Passed: fractional pieces/atoms, mixed dimensions, negative/NaN/infinite inputs, overflow and invalid tender/change sums reject atomically. |
| EP03-T05 | Passed: prepared cookie portion consumes portion/toppings/packaging without raw-production deduction.                                       |
| EP03-T06 | Passed: refund retains consumption; only an exact adapter-verified unprepared return restores stock once.                                   |
| EP03-T07 | Passed: cyclic recipes and conflicting stable IDs fail without effects. Branching recipe DAG regression checks memoized expansion.          |

Additional tests cover seeded 120-sale streams, explicit uncounted/zero/not-brought classifications, empty drafts, duplicate packing answers, role/tenant/epoch/installation/snapshot isolation, trusted operation-bound stock approvals, gross/discount/net distinction, terminal close, and supported v1 fixtures.

## Review and preservation

The reviewer identified repeated recipe graph expansion as a CPU-bound risk; root implemented memoized depth/consumption and the independent 25-node branching regression passed. Review also confirmed trusted prep/stock evidence instead of payload flags, and exact discounted-money semantics. No unresolved EP03 correctness finding remains in the independent report.

No database migration was part of EP03. Rollback leaves additive v2 modules unused while retaining all v1 parsers and data. Do not reinterpret a v2 journal using v1 or current mutable catalog values. Storage/backend integration begins only after this shared contract freeze; EP06+ remains outside the authorized run.
