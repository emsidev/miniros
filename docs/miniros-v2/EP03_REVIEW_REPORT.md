# EP03 independent arithmetic and contract review

## Identity and scope

Independent reviewer: `independent_review`. Local `dev` baseline `0056f316cf811f10f943d56c4c987b1642844938` plus the in-progress working diff, 7 September 2026. The lead owns domain/contracts implementation and fixture definitions. The reviewer owns `packages/domain/tests/v2-review.test.ts`, `packages/contracts/tests/v2-review.test.ts`, and this report. No production reducer is used to calculate expected values.

EP03's full plan and common product/test contracts were read. The independently calculated oracle, final versioned API and adversarial implementation tests are now reviewed. This is unit/property evidence for the shared contracts, not native-storage, server-authentication or device evidence.

## Fixed independent golden oracle

The retained fixture is synthetic. Event A sells two ube drinks for 30,000 minor units; B sells one plain drink for 12,000; C sells one ube drink for 15,000 then refunds 15,000 without returning materials; H sells one cookie cup for 10,000. D is one complimentary plain drink and E one ube remake, both consuming materials without increasing paid revenue.

| Financial/count value                   | Independent calculation                                       | Fixed expected value |
| --------------------------------------- | ------------------------------------------------------------- | -------------------- |
| Gross sales                             | 30,000 + 12,000 + 15,000 + 10,000                             | 67,000               |
| Refunds                                 | C cash refund                                                 | 15,000               |
| Net sales                               | 67,000 − 15,000                                               | 52,000               |
| Retained cash before refunds            | A 30,000 + C 15,000 + H 10,000; A's 20,000 change is excluded | 55,000               |
| Net cash                                | 55,000 − 15,000                                               | 40,000               |
| Net manual digital                      | B                                                             | 12,000               |
| Closing cash                            | Float 200,000 + net cash 40,000                               | 240,000              |
| Paid orders / paid items before refunds | A, B, C, H / 2 + 1 + 1 + 1                                    | 4 / 5                |
| Complimentary / remake items            | D / E                                                         | 1 / 1                |
| Cash / cup variance examples            | 239,000 − 240,000 / 92 − 93                                   | −1,000 / −1          |

There are six matcha drinks in total: four ube (A×2, C, E) and two plain (B, D). C's refund retains its material usage. H consumes a prepared cookie portion, so no raw-production ingredients are consumed again.

| Stock item      | Independent base-unit calculation             | Remaining base units | Remaining integer atoms |
| --------------- | --------------------------------------------- | -------------------- | ----------------------- |
| Matcha          | 1,000 − 6×4 g                                 | 976 g                | 976,000                 |
| Milk            | 10,000 + 1,000 restock − 6×150 − 200 waste ml | 9,900 ml             | 9,900,000               |
| Ube             | 3,000 − 4×30 g                                | 2,880 g              | 2,880,000               |
| Cups            | 100 − 6 drinks − 1 cookie cup                 | 93                   | 93                      |
| Lids            | 100 − 6 drinks                                | 94                   | 94                      |
| Straws          | 100 − 6 drinks                                | 94                   | 94                      |
| Cookie portions | 6 − 1                                         | 5                    | 5                       |
| Ice cream       | 1,000 − 80 g                                  | 920 g                | 920,000                 |
| Spoons          | 20 − 1 cookie cup                             | 19                   | 19                      |

The independent pack example is 3×1,000 + 400 = **3,400 ml = 3,400,000 atoms**. Every other actual stock count remains unverified unless explicitly entered. Uncounted, counted zero and not brought must remain distinct.

The reviewer executed a standalone Node `node:assert/strict` check comparing every `fixture.expected` field to these independently entered formulas and constants. It passed. That check imported only the JSON fixture, not domain implementation. The fixture was not edited.

## Implemented adversarial coverage

- EP03-T01/T02: fixed oracle, every duplicate operation, repeated refund/remake, duplicate ID with altered canonical payload, stable operation identities and no repeat effects.
- EP03-T03/T05: clone/freeze snapshot; change caller-owned master prices/recipes/pack sizes afterward; consume prepared portion/toppings/packaging without raw-production double deduction.
- EP03-T04/T06: integer safe-range/overflow, fractional pieces, incompatible dimensions, negative/NaN/infinite quantities, tender balancing/change, bounded refunds, explicit verified physical return only, and rejection without mutation of prior state.
- EP03-T07: nested/cyclic recipe definitions, snapshot/tenant/origin/epoch/role mismatch, out-of-order/sequence conflict policy, unsupported schema and unchanged supported legacy envelope semantics.
- A deterministic seed of 1337 drives 120 sales across cash/digital tenders, duplicate deliveries and full refunds every fourth sale. Separate input-based arithmetic tracks gross/refunds/net cash/digital and exact recipe usage; all stock atoms remain safe nonnegative integers. Expected golden constants remain literal oracle values in review tests.
- Exact trusted prep confirmations are required for prep state changes and unprepared returns; payload booleans alone fail. A delayed accepted Start cannot undo Done. A verified physical return restores stock once and does not itself refund money.
- Stock approval evidence is bound to the exact operation ID, item ID and delta. Missing evidence and transfer to another operation/item/delta fail before effects.
- Empty cart/count/answer draft collections remain saveable. Duplicate packing answers/counts fail; committed opening counts remain nonempty and fully resolved.
- Gross sales, discounts and net sales remain separate: a 12,000-price sale with a one-unit discount yields gross 12,000, discount 1, net 11,999. Cash handed over includes change only in the tender record; expected cash includes retained cash.

## Commands and actual results

| Exact command                                                                                                                                                                                                                                 | Actual result                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `corepack pnpm --filter @miniros/domain exec vitest run tests/v2-review.test.ts`                                                                                                                                                              | **35 passed, 0 failed, 0 skipped**. |
| `corepack pnpm --filter @miniros/contracts exec vitest run tests/v2-review.test.ts`                                                                                                                                                           | **37 passed, 0 failed, 0 skipped**. |
| `corepack pnpm exec tsc --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --skipLibCheck --strict --esModuleInterop --resolveJsonModule packages/domain/tests/v2-review.test.ts packages/contracts/tests/v2-review.test.ts` | Passed.                             |
| `corepack pnpm --filter @miniros/domain exec eslint tests/v2-review.test.ts`                                                                                                                                                                  | Passed.                             |
| `corepack pnpm --filter @miniros/contracts exec eslint tests/v2-review.test.ts`                                                                                                                                                               | Passed.                             |
| `corepack pnpm exec prettier --check packages/domain/tests/v2-review.test.ts packages/contracts/tests/v2-review.test.ts`                                                                                                                      | Passed.                             |

All seven EP03 acceptance IDs map to named tests in the domain review file, with strict schema/digest/version boundaries additionally covered in the contracts review file. The independent total is **72 tests**, separate from implementer/legacy suites. The golden fixture is unchanged. No hosted database, production service or native device was used.

## Source findings and contract closure

The independent source review identified a P2 complexity risk in recursively expanding shared recipe references: a small acyclic input can create exponential work without memoization or an expansion bound. The final core memoizes graph validation/consumption. A 25-node branching-DAG regression returns exactly 16,777,216 matcha atoms within the bounded test, and cyclic recipes remain rejected. No unresolved complexity finding remains.

The lead's final security and accounting contract changes are covered independently: trusted prep confirmations, exact stock-approval evidence, gross/discount separation, duplicate-answer rejection and editable empty drafts. An oversized structurally valid closing envelope is rejected at creation; malformed or oversized received JSON is rejected before applying effects. Signature metadata validation is explicitly **structural only** in EP03. The tests use a clearly synthetic 64-byte all-zero signature; Ed25519 verification and construction of trusted actor evidence belong to EP05's authorized adapter.

Version 2 uses explicit lowercase UUIDs, schema/protocol version 2 and integer atoms. Version 1 retains its original parser and rounded quantity semantics: a supported old count of `"1.2346"` still parses to `1.235`, and neither parser silently relabels it as v2. Local migration, actual durable replay and server ingestion are separate EP04/EP05 responsibilities.

## Review status

Arithmetic oracle: **VERIFIED**. Implementation/API review: **ACCEPTED**. Automated unit/property acceptance: **PASSED**, 72 independent tests, zero failures/skips. No unresolved independent finding remains.

EP03's shared-domain/contract gate is accepted for the reviewed local working diff. This does not accept EP02's blocked physical transport gate, EP04 persistence, EP05 cryptographic/tenant enforcement, or a production release. Rollback preserves version-1 ingestion and retained journals; no fixture, production schema or historical data was changed by this reviewer.
