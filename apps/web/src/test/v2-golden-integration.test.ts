import {
  createHash,
  generateKeyPairSync,
  randomUUID,
  sign,
  verify,
} from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterAll, describe, expect, it, vi } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { createDatabase, createPostgresClient } from "@miniros/db";
import * as tables from "@miniros/db/schema";
import {
  canonicalV2,
  createV2Snapshot,
  journalDigestV2,
  sealV2Operation,
  sealV2PrepCommand,
  summaryV2,
  v2Kinds,
  type V2Actor,
  type V2Kind,
  type V2Operation,
  type V2PrepCommand,
  type V2SnapshotBody,
} from "@miniros/domain/v2";
import golden from "../../../../docs/miniros-v2/fixtures/golden-shift.json";
import { LocalSqliteConnection } from "../../../mobile/src/storage/v2/connection";
import { LedgerRepository } from "../../../mobile/src/storage/v2/repository";
import type { RawSqliteConnection } from "../../../mobile/src/storage/v2/types";
import { assertDisposableDatabase } from "./isolation-guard";

const auth = vi.hoisted(() => ({ users: new Map<string, string>() }));
vi.mock("@/lib/env", () => ({
  getSupabasePublicEnv: () => ({
    url: "https://synthetic.invalid",
    publishableKey: "synthetic-public-key",
  }),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      getUser: async (token: string) => ({
        data: {
          user: auth.users.has(token) ? { id: auth.users.get(token) } : null,
        },
        error: null,
      }),
    },
  }),
}));
import { authenticateNative } from "@/server/services/native-v2/auth";
import { createNativeV2Service } from "@/server/services/native-v2/service";
const url = process.env.SHIFT_TEST_DATABASE_URL;
if (url) assertDisposableDatabase(url);
const database = url ? createDatabase(url) : null;
afterAll(async () => {
  if (url) await createPostgresClient(url).end();
  vi.unstubAllEnvs();
});
const hash = async (value: string) =>
  createHash("sha256").update(value).digest("hex");
function sqlite(path: string): RawSqliteConnection {
  const db = new DatabaseSync(path);
  return {
    exec: async (statement) => {
      db.exec(statement);
    },
    run: async (statement, values = []) => ({
      changes: Number(db.prepare(statement).run(...values).changes),
    }),
    all: async <T>(
      statement: string,
      values: readonly (string | number | null)[] = [],
    ) => db.prepare(statement).all(...values) as T[],
    close: async () => {
      db.close();
    },
  };
}

describe.skipIf(!url)(
  "EP03–EP05 golden SQLite to PostgreSQL integration",
  () => {
    it("saves the whole shift offline, restarts, then drains cloud with original receipts and independent peer/media queues", async () => {
      const db = database!;
      vi.stubEnv("MINIROS_NATIVE_V2_NEW_SHIFTS_ENABLED", "1");
      const id = {
        business: randomUUID(),
        location: randomUUID(),
        shift: randomUUID(),
        owner: randomUUID(),
        cashier: randomUUID(),
        prep: randomUUID(),
        cashierInstall: randomUUID(),
        prepInstall: randomUUID(),
      };
      const now = new Date("2026-09-07T10:00:00.000Z");
      await db.transaction(async (tx) => {
        await tx
          .insert(tables.authUsers)
          .values(
            [id.owner, id.cashier, id.prep].map((userId) => ({ id: userId })),
          );
        await tx.insert(tables.businesses).values({
          id: id.business,
          name: "Synthetic golden v2 integration",
          createdBy: id.owner,
        });
        await tx.insert(tables.sellingLocations).values({
          id: id.location,
          businessId: id.business,
          name: "Synthetic booth",
        });
        await tx.insert(tables.shifts).values({
          id: id.shift,
          businessId: id.business,
          sellingLocationId: id.location,
          shiftDate: "2026-09-07",
          status: "scheduled",
        });
        for (const [userId, role] of [
          [id.owner, "owner"],
          [id.cashier, "cashier"],
          [id.prep, "prep"],
        ] as const) {
          const memberId = randomUUID(),
            employeeId = randomUUID();
          await tx.insert(tables.businessMembers).values({
            id: memberId,
            businessId: id.business,
            authUserId: userId,
            role: role === "owner" ? "owner" : "employee",
            status: "active",
          });
          if (role === "owner") continue;
          await tx.insert(tables.employees).values({
            id: employeeId,
            businessId: id.business,
            memberId,
            displayName: role,
            canUsePos: role === "cashier",
            canLogProduction: true,
          });
          await tx.insert(tables.shiftAssignments).values({
            id: randomUUID(),
            businessId: id.business,
            shiftId: id.shift,
            employeeId,
            roleOnShift: role === "cashier" ? "operator" : "employee",
            status: "assigned",
          });
        }
      });
      async function identity(userId: string) {
        const token = randomUUID();
        auth.users.set(token, userId);
        return authenticateNative(
          new Request("http://localhost/native", {
            headers: { authorization: `Bearer ${token}` },
          }),
        );
      }
      const [owner, cashier, prep] = await Promise.all([
        identity(id.owner),
        identity(id.cashier),
        identity(id.prep),
      ]);
      const itemIds = Object.fromEntries(
        Object.keys(golden.items).map((name) => [name, randomUUID()]),
      );
      const productIds = Object.fromEntries(
        Object.keys(golden.products).map((name) => [name, randomUUID()]),
      );
      const recipeIds = Object.fromEntries(
        Object.keys(golden.products).map((name) => [name, randomUUID()]),
      );
      const body: V2SnapshotBody = {
        schemaVersion: 2,
        id: randomUUID(),
        businessId: id.business,
        shiftId: id.shift,
        version: 1,
        catalogVersion: "golden-001",
        recipeVersion: "golden-001",
        costingVersion: "golden-001",
        checklist: { id: randomUUID(), version: 1, entries: [] },
        items: Object.entries(golden.items).map(([name, item]) => ({
          id: itemIds[name]!,
          name,
          category: "Synthetic",
          unit: item.unit as "g" | "ml" | "pc",
          atomScale: item.atom_scale as 1 | 1000,
          prepared: name === "cookie_portions",
          unitCostMinor: 0,
          packs: [],
        })),
        recipes: Object.entries(golden.products).map(([name, product]) => ({
          id: recipeIds[name]!,
          ingredients: Object.entries(product.recipe).map(
            ([item, quantity]) => ({
              kind: "item",
              itemId: itemIds[item]!,
              atoms:
                quantity *
                golden.items[item as keyof typeof golden.items].atom_scale,
            }),
          ),
        })),
        products: Object.entries(golden.products).map(([name, product]) => ({
          id: productIds[name]!,
          name,
          priceMinor: product.price_minor,
          costMinor: 0,
          recipeId: recipeIds[name]!,
          modifierIds: [],
        })),
        modifiers: [],
      };
      const snapshot = await createV2Snapshot(body, hash);
      const service = createNativeV2Service(db, { now: () => now });
      await service.registerSnapshot(owner, {
        snapshot,
        cashierInstallationId: id.cashierInstall,
      });
      const cashierKeys = generateKeyPairSync("ed25519"),
        prepKeys = generateKeyPairSync("ed25519");
      const cashierGrant = await service.issueGrant(owner, {
        businessId: id.business,
        shiftId: id.shift,
        userId: id.cashier,
        installationId: id.cashierInstall,
        role: "cashier",
        grantSpki: cashierKeys.publicKey
          .export({ type: "spki", format: "pem" })
          .toString(),
        ttlSeconds: 86400,
      });
      const prepGrant = await service.issueGrant(owner, {
        businessId: id.business,
        shiftId: id.shift,
        userId: id.prep,
        installationId: id.prepInstall,
        role: "prep",
        grantSpki: prepKeys.publicKey
          .export({ type: "spki", format: "pem" })
          .toString(),
        ttlSeconds: 86400,
      });
      const commands: V2PrepCommand[] = [];
      const confirmations: NonNullable<
        V2Actor["verifiedPrepCommands"]
      >[number][] = [];
      const actor: V2Actor = {
        businessId: id.business,
        shiftId: id.shift,
        installationId: id.cashierInstall,
        cashierInstallationId: id.cashierInstall,
        authorityEpoch: 1,
        role: "cashier",
        allowedKinds: v2Kinds.filter((kind) => kind !== "ADJUST_STOCK"),
        verifiedPrepCommands: confirmations,
      };
      const directory = mkdtempSync(join(tmpdir(), "miniros-v2-golden-"));
      let connection = await LocalSqliteConnection.open(
        sqlite(join(directory, "ledger.db")),
      );
      const dependencies = {
        hash,
        now: () => now.toISOString(),
        authority: {
          currentIdentity: () => ({
            accountId: id.cashier,
            businessId: id.business,
            installationId: id.cashierInstall,
            locked: false,
          }),
          authorizeSnapshot: async () => actor,
          authorizeOperation: async (operation: V2Operation) => {
            if (
              operation.authenticity.grantId !== cashierGrant.id ||
              !verify(
                null,
                Buffer.from(operation.canonicalDigest),
                cashierKeys.publicKey,
                Buffer.from(operation.authenticity.signature, "base64"),
              )
            )
              throw new Error("Invalid local signature");
            return actor;
          },
          authorizeReceipt: async () => {
            /* Test calls only direct results from the authenticated service. */
          },
        },
      };
      let repository = new LedgerRepository(connection, dependencies);
      try {
        await repository.initialize();
        const scope = await repository.storeSnapshot(snapshot);
        const operations: V2Operation[] = [];
        const localReceipts: unknown[] = [];
        async function commit(kind: V2Kind, payload: unknown) {
          const opBody = {
            schemaVersion: 2,
            protocolVersion: 2,
            operationId: randomUUID(),
            businessId: id.business,
            shiftId: id.shift,
            snapshotId: snapshot.id,
            snapshotHash: snapshot.hash,
            installationId: id.cashierInstall,
            authorityEpoch: 1,
            sequence: operations.length + 1,
            occurredAt: now.toISOString(),
            kind,
            payload,
          };
          const canonicalDigest = await hash(canonicalV2(opBody));
          const operation = await sealV2Operation(
            opBody,
            {
              scheme: "ed25519",
              grantId: cashierGrant.id,
              signature: sign(
                null,
                Buffer.from(canonicalDigest),
                cashierKeys.privateKey,
              ).toString("base64"),
            },
            hash,
          );
          const result = await repository.commit(
            operation,
            kind === "SALE"
              ? {
                  attachments: [
                    {
                      attachmentId: randomUUID(),
                      localUri: "file:///synthetic/proof.jpg",
                      mediaDigest: "a".repeat(64),
                    },
                  ],
                }
              : {},
          );
          operations.push(operation);
          localReceipts.push(result.receipt);
          return operation;
        }
        await commit("OPEN_SHIFT", {
          reviewed: true,
          openingCashMinor: 200000,
          counts: Object.entries(golden.items).map(([name, item]) => ({
            itemId: itemIds[name],
            kind: "counted",
            atoms: item.opening * item.atom_scale,
          })),
        });
        const sales: Record<string, string> = {};
        for (const event of golden.events) {
          if (event.kind === "sale") {
            const saleId = randomUUID();
            sales[event.id] = saleId;
            await commit("SALE", {
              saleId,
              lines: [
                {
                  productId: productIds[event.product!],
                  quantity: event.quantity,
                  modifierIds: [],
                },
              ],
              discountMinor: 0,
              tenders: [
                {
                  method: event.tender,
                  tenderedMinor: event.tendered_minor,
                  changeMinor: event.change_minor,
                },
              ],
            });
            for (const action of ["making", "done"] as const) {
              const commandBody = {
                schemaVersion: 2,
                protocolVersion: 2,
                commandId: randomUUID(),
                businessId: id.business,
                shiftId: id.shift,
                snapshotId: snapshot.id,
                snapshotHash: snapshot.hash,
                installationId: id.prepInstall,
                authorityEpoch: 1,
                saleId,
                action,
                occurredAt: now.toISOString(),
              };
              const digest = await hash(canonicalV2(commandBody));
              const command = await sealV2PrepCommand(
                commandBody,
                {
                  scheme: "ed25519",
                  grantId: prepGrant.id,
                  signature: sign(
                    null,
                    Buffer.from(digest),
                    prepKeys.privateKey,
                  ).toString("base64"),
                },
                hash,
              );
              expect(
                verify(
                  null,
                  Buffer.from(digest),
                  prepKeys.publicKey,
                  Buffer.from(command.authenticity.signature, "base64"),
                ),
              ).toBe(true);
              commands.push(command);
              confirmations.push({
                commandId: command.commandId,
                saleId,
                prepInstallationId: id.prepInstall,
                action,
              });
              await commit("PREP_TRANSITION", {
                saleId,
                commandId: command.commandId,
                prepInstallationId: id.prepInstall,
                next: action,
              });
            }
          } else if (event.kind === "refund")
            await commit("REFUND", {
              saleId: sales[event.sale_id!],
              amountMinor: event.amount_minor,
              method: event.tender,
              reason: event.reason,
            });
          else if (event.kind === "complimentary" || event.kind === "remake")
            await commit(event.kind === "remake" ? "REMAKE" : "COMPLIMENTARY", {
              ...(event.kind === "remake"
                ? { saleId: sales[event.sale_id!] }
                : {}),
              lines: [
                {
                  productId: productIds[event.product!],
                  quantity: event.quantity,
                  modifierIds: [],
                },
              ],
              reason: "Synthetic golden usage",
            });
          else
            await commit(event.kind === "waste" ? "WASTE" : "RESTOCK", {
              itemId: itemIds[event.item!],
              atoms:
                event.quantity! *
                golden.items[event.item as keyof typeof golden.items]
                  .atom_scale,
              reason: "Synthetic golden stock event",
            });
        }
        const expectedStock = {
          matcha: 976000,
          milk: 9900000,
          ube: 2880000,
          cups: 93,
          lids: 94,
          straws: 94,
          cookie_portions: 5,
          ice_cream: 920000,
          spoons: 19,
        };
        const stock = Object.fromEntries(
          Object.entries(expectedStock).map(([name, atoms]) => [
            itemIds[name]!,
            atoms,
          ]),
        );
        const beforeClose = await repository.readProjection(scope);
        expect(summaryV2(beforeClose)).toMatchObject({
          grossSalesMinor: 67000,
          discountsMinor: 0,
          refundsMinor: 15000,
          netSalesMinor: 52000,
          expectedCashMinor: 240000,
          netCashSalesMinor: 40000,
          netManualDigitalMinor: 12000,
          stockAtoms: stock,
        });
        await commit("CLOSE_SHIFT", {
          manifestId: randomUUID(),
          lastFinancialSequence: operations.length,
          journalDigest: await journalDigestV2(beforeClose, hash),
          expectedCashMinor: 240000,
          netSalesMinor: 52000,
          expectedStockAtoms: stock,
          actualCashMinor: 239000,
          counts: Object.values(itemIds).map((itemId) =>
            itemId === itemIds.cups
              ? { itemId, kind: "counted", atoms: 92 }
              : { itemId, kind: "uncounted" },
          ),
          pendingAttachmentIds: (await repository.attachments(scope)).map(
            (job) => job.attachmentId,
          ),
          manualResolutions: [],
        });
        expect((await repository.readiness(scope)).cloudPending).toBe(19);
        const [untouched] = await db
          .select()
          .from(tables.v2Authorities)
          .where(eq(tables.v2Authorities.shiftId, id.shift));
        expect(untouched!.lastSequence).toBe(0); // All financial writes were local-only.
        await connection.close();
        connection = await LocalSqliteConnection.open(
          sqlite(join(directory, "ledger.db")),
        );
        repository = new LedgerRepository(connection, dependencies);
        await repository.initialize();
        expect((await repository.readiness(scope)).projection.state).toBe(
          "closed",
        );
        for (const [index, operation] of operations.entries()) {
          expect((await repository.commit(operation)).receipt).toEqual(
            localReceipts[index],
          );
          const first = await service.ingest(cashier, operation);
          expect(first.ok).toBe(true);
          if (!first.ok) throw new Error(first.code);
          if (index === 0)
            for (const command of commands)
              expect((await service.submitPrep(prep, command)).ok).toBe(true);
          // Pretend the first HTTP response was lost, then persist only the retry.
          const retry = await service.ingest(cashier, operation);
          expect(retry).toEqual(first);
          await repository.recordReceipt(first.receipt);
        }
        const ready = await repository.readiness(scope);
        expect(ready).toMatchObject({
          operationCount: 19,
          cloudPending: 0,
          peerPending: 19,
          attachmentPending: 4,
        });
        const [cloud] = await db
          .select()
          .from(tables.v2Authorities)
          .where(eq(tables.v2Authorities.shiftId, id.shift));
        expect(cloud!.projection).toEqual(ready.projection);
        const [effectCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(tables.v2Effects)
          .where(
            and(
              eq(tables.v2Effects.businessId, id.business),
              eq(tables.v2Effects.shiftId, id.shift),
            ),
          );
        expect(effectCount!.count).toBe(19);
        const [legacyStock] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(tables.inventoryEvents)
          .where(eq(tables.inventoryEvents.businessId, id.business));
        expect(legacyStock!.count).toBe(0);
      } finally {
        await connection.close();
        rmSync(directory, { recursive: true, force: true });
      }
    });
  },
);
