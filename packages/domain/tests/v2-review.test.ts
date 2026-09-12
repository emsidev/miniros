import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import fixture from "../../../docs/miniros-v2/fixtures/golden-shift.json";
import {
  canonicalV2,
  consumeV2Lines,
  createV2Snapshot,
  exactAtoms,
  journalDigestV2,
  packCountAtoms,
  sealV2Operation,
  verifyV2Snapshot,
} from "../src/v2/core";
import {
  initialV2Projection,
  applyV2Operation,
  summaryV2,
} from "../src/v2/reducer";
import {
  v2Kinds,
  type V2Actor,
  type V2Hash,
  type V2Kind,
  type V2Operation,
  type V2Projection,
  type V2SnapshotBody,
} from "../src/v2/types";

const uuid = (n: number) =>
  `00000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;
const hash: V2Hash = async (text) =>
  createHash("sha256").update(text).digest("hex");
const auth = {
  scheme: "ed25519" as const,
  grantId: uuid(10),
  signature: Buffer.alloc(64).toString("base64"),
};
const itemNames = Object.keys(fixture.items) as Array<
  keyof typeof fixture.items
>;
const productNames = Object.keys(fixture.products) as Array<
  keyof typeof fixture.products
>;
const itemId = (name: string) =>
  uuid(100 + itemNames.indexOf(name as keyof typeof fixture.items));
const productId = (name: string) =>
  uuid(300 + productNames.indexOf(name as keyof typeof fixture.products));
const eventId = (name: string) =>
  uuid(500 + fixture.events.findIndex((event) => event.id === name));
function snapshotBody() {
  return {
    schemaVersion: 2 as const,
    id: uuid(1),
    businessId: uuid(2),
    shiftId: uuid(3),
    version: 1,
    catalogVersion: "synthetic-1",
    recipeVersion: "synthetic-1",
    costingVersion: "synthetic-1",
    checklist: {
      id: uuid(4),
      version: 1,
      entries: [{ id: uuid(5), label: "Gloves", critical: true }],
    },
    items: itemNames.map((name, index) => ({
      id: itemId(name),
      name: String(name),
      category: "synthetic",
      unit: fixture.items[name].unit as "g" | "ml" | "pc",
      atomScale: fixture.items[name].atom_scale as 1 | 1000,
      prepared: name === "cookie_portions",
      unitCostMinor: 0,
      packs: [
        {
          id: uuid(400 + index),
          unit: fixture.items[name].unit as "g" | "ml" | "pc",
          atoms: 1000 * fixture.items[name].atom_scale,
        },
      ],
    })),
    recipes: productNames.map((name, index) => ({
      id: uuid(200 + index),
      ingredients: Object.entries(fixture.products[name].recipe).map(
        ([ingredient, quantity]) => ({
          kind: "item" as const,
          itemId: itemId(ingredient),
          atoms:
            quantity *
            fixture.items[ingredient as keyof typeof fixture.items].atom_scale,
        }),
      ),
    })),
    products: productNames.map((name, index) => ({
      id: productId(name),
      name,
      priceMinor: fixture.products[name].price_minor,
      costMinor: 0,
      recipeId: uuid(200 + index),
      modifierIds: [] as string[],
    })),
    modifiers: [] as Array<{
      id: string;
      name: string;
      priceMinor: number;
      ingredients: Array<{ kind: "item"; itemId: string; atoms: number }>;
    }>,
  } satisfies V2SnapshotBody;
}
async function harness(body = snapshotBody(), multiplier = 1) {
  const snapshot = await createV2Snapshot(body, hash);
  const verifiedPrepCommands: NonNullable<
    V2Actor["verifiedPrepCommands"]
  >[number][] = [];
  const verifiedStockApprovals: NonNullable<
    V2Actor["verifiedStockApprovals"]
  >[number][] = [];
  const actor: V2Actor = {
    businessId: snapshot.businessId,
    shiftId: snapshot.shiftId,
    installationId: uuid(6),
    cashierInstallationId: uuid(6),
    authorityEpoch: 1,
    role: "cashier",
    allowedKinds: [...v2Kinds],
    verifiedPrepCommands,
    verifiedStockApprovals,
  };
  let state = initialV2Projection(snapshot, actor);
  const operations: V2Operation[] = [];
  async function operation(
    kind: V2Kind,
    payload: unknown,
    overrides: Record<string, unknown> = {},
  ) {
    return sealV2Operation(
      {
        protocolVersion: 2,
        schemaVersion: 2,
        operationId: uuid(1000 + state.lastSequence + 1),
        businessId: snapshot.businessId,
        shiftId: snapshot.shiftId,
        snapshotId: snapshot.id,
        snapshotHash: snapshot.hash,
        installationId: actor.installationId,
        authorityEpoch: 1,
        sequence: state.lastSequence + 1,
        occurredAt: "2026-09-07T00:00:00.000Z",
        kind,
        payload,
        ...overrides,
      },
      auth,
      hash,
    );
  }
  async function apply(
    kind: V2Kind,
    payload: unknown,
    overrides: Record<string, unknown> = {},
  ) {
    const value = await operation(kind, payload, overrides);
    state = await applyV2Operation(snapshot, state, value, actor, hash);
    operations.push(value);
    return value;
  }
  const counts = itemNames.map((name) => ({
    itemId: itemId(name),
    kind: "counted" as const,
    atoms:
      fixture.items[name].opening * fixture.items[name].atom_scale * multiplier,
  }));
  return {
    snapshot,
    actor,
    operations,
    counts,
    operation,
    apply,
    trust: (command: (typeof verifiedPrepCommands)[number]) => {
      verifiedPrepCommands.push(command);
    },
    approve: (approval: (typeof verifiedStockApprovals)[number]) => {
      verifiedStockApprovals.push(approval);
    },
    state: () => state,
    open: () =>
      apply("OPEN_SHIFT", {
        counts,
        openingCashMinor: fixture.opening_cash_minor,
        reviewed: true,
      }),
  };
}
type Harness = Awaited<ReturnType<typeof harness>>;
async function prepTransition(
  h: Harness,
  saleId: string,
  next: "making" | "done",
  commandId: string,
) {
  h.trust({ commandId, saleId, prepInstallationId: uuid(7), action: next });
  return h.apply("PREP_TRANSITION", {
    saleId,
    commandId,
    prepInstallationId: uuid(7),
    next,
  });
}
const lines = (name = "plain_matcha", quantity = 1) => [
  { productId: productId(name), quantity, modifierIds: [] },
];
const sale = (saleId = uuid(700), quantity = 1) => ({
  saleId,
  lines: lines("plain_matcha", quantity),
  discountMinor: 0,
  tenders: [
    { method: "cash", tenderedMinor: quantity * 12000, changeMinor: 0 },
  ],
});
async function golden(h: Harness) {
  await h.open();
  for (const original of fixture.events) {
    const event = original as unknown as Record<string, unknown>;
    const reason = String(event.reason ?? "Independent synthetic fixture");
    switch (event.kind) {
      case "sale": {
        const saleId = eventId(String(event.id));
        await h.apply("SALE", {
          saleId,
          lines: lines(String(event.product), Number(event.quantity)),
          discountMinor: 0,
          tenders: [
            {
              method: event.tender,
              tenderedMinor: event.tendered_minor,
              changeMinor: event.change_minor,
            },
          ],
        });
        if (event.prepared) {
          await prepTransition(
            h,
            saleId,
            "making",
            uuid(2000 + h.state().lastSequence),
          );
          await prepTransition(
            h,
            saleId,
            "done",
            uuid(2000 + h.state().lastSequence),
          );
        }
        break;
      }
      case "refund":
        await h.apply("REFUND", {
          saleId: eventId(String(event.sale_id)),
          amountMinor: event.amount_minor,
          method: event.tender,
          reason,
        });
        break;
      case "complimentary":
        await h.apply("COMPLIMENTARY", {
          lines: lines(String(event.product), Number(event.quantity)),
          reason,
        });
        break;
      case "remake":
        await h.apply("REMAKE", {
          saleId: eventId(String(event.sale_id)),
          lines: lines(String(event.product), Number(event.quantity)),
          reason,
        });
        break;
      case "waste":
      case "restock":
        await h.apply(event.kind === "waste" ? "WASTE" : "RESTOCK", {
          itemId: itemId(String(event.item)),
          atoms:
            Number(event.quantity) *
            fixture.items[String(event.item) as keyof typeof fixture.items]
              .atom_scale,
          reason,
        });
        break;
      default:
        throw new Error(
          `Unknown independent fixture event ${String(event.kind)}`,
        );
    }
  }
}
function stockByName(state: V2Projection) {
  return Object.fromEntries(
    itemNames.map((name) => [name, state.stockAtoms[itemId(name)]]),
  );
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

describe("EP03 independent fixed arithmetic and failure review", () => {
  it("binds a trusted stock approval to the exact operation, item and delta", async () => {
    const h = await harness();
    await h.open();
    const payload = {
      approvalId: uuid(950),
      itemId: itemId("milk"),
      deltaAtoms: 1000,
      reason: "Reviewed correction",
    };
    const before = canonicalV2(h.state());
    await expect(h.apply("ADJUST_STOCK", payload)).rejects.toThrow();
    expect(canonicalV2(h.state())).toBe(before);
    const candidate = await h.operation("ADJUST_STOCK", payload);
    h.approve({
      approvalId: payload.approvalId,
      operationId: candidate.operationId,
      itemId: payload.itemId,
      deltaAtoms: 1000,
    });
    for (const [patch, overrides] of [
      [{ ...payload, itemId: itemId("cups") }, {}],
      [{ ...payload, deltaAtoms: 1001 }, {}],
      [payload, { operationId: uuid(951) }],
    ] as const) {
      await expect(h.apply("ADJUST_STOCK", patch, overrides)).rejects.toThrow();
      expect(canonicalV2(h.state())).toBe(before);
    }
    await h.apply("ADJUST_STOCK", payload);
    expect(h.state().stockAtoms[itemId("milk")]).toBe(10001000);
    await expect(h.apply("ADJUST_STOCK", payload)).rejects.toThrow();
  });

  it("EP03-T01 replays source fixture inputs against literal independent money and atom constants", async () => {
    const h = await harness();
    await golden(h);
    expect(summaryV2(h.state())).toMatchObject({
      grossSalesMinor: 67000,
      refundsMinor: 15000,
      netSalesMinor: 52000,
      netCashSalesMinor: 40000,
      netManualDigitalMinor: 12000,
      expectedCashMinor: 240000,
    });
    expect(stockByName(h.state())).toEqual(expectedStock);
    expect(h.state()).toMatchObject({
      paidOrderCount: 4,
      paidItemQuantity: 5,
      complimentaryItemQuantity: 1,
      remadeItemQuantity: 1,
    });
  });

  it("EP03-T02 replays all original IDs including refund/remake after later events with no additional effects", async () => {
    const h = await harness();
    await golden(h);
    let replayed = h.state();
    for (const operation of [...h.operations, ...h.operations].reverse())
      replayed = await applyV2Operation(
        h.snapshot,
        replayed,
        operation,
        h.actor,
        hash,
      );
    expect(replayed).toEqual(h.state());
    expect(stockByName(replayed)).toEqual(expectedStock);
  });

  it("EP03-T03 freezes recipes, prices and packs deeply without freezing or retaining the caller's mutable master", async () => {
    const body = snapshotBody();
    const h = await harness(body);
    body.products[0]!.priceMinor = 1;
    body.recipes[0]!.ingredients[0]!.atoms = 1;
    body.items[0]!.packs[0]!.atoms = 1;
    expect(Object.isFrozen(body)).toBe(false);
    expect(Object.isFrozen(h.snapshot.products[0])).toBe(true);
    expect(Object.isFrozen(h.snapshot.recipes[0]!.ingredients)).toBe(true);
    expect(Object.isFrozen(h.snapshot.items[0]!.packs[0])).toBe(true);
    await golden(h);
    expect(summaryV2(h.state()).netSalesMinor).toBe(52000);
    expect(stockByName(h.state())).toEqual(expectedStock);
  });

  it("EP03-T03 rejects a tampered snapshot with its old digest before consuming historical stock", async () => {
    const h = await harness();
    const tampered = JSON.parse(JSON.stringify(h.snapshot));
    tampered.products[0].priceMinor = 1;
    await expect(verifyV2Snapshot(tampered, hash)).rejects.toThrow(
      "SNAPSHOT_DIGEST",
    );
  });

  it.each([-1, NaN, Infinity, 0.1, Number.MAX_SAFE_INTEGER + 1])(
    "EP03-T04 rejects sale quantity %s without partial projection changes",
    async (quantity) => {
      const h = await harness();
      await h.open();
      const before = canonicalV2(h.state());
      await expect(
        h.apply("SALE", { ...sale(), lines: lines("plain_matcha", quantity) }),
      ).rejects.toThrow();
      expect(canonicalV2(h.state())).toBe(before);
    },
  );

  it.each([
    [{ method: "cash", tenderedMinor: 11999, changeMinor: 0 }],
    [{ method: "cash", tenderedMinor: 12001, changeMinor: 0 }],
    [{ method: "cash", tenderedMinor: 100, changeMinor: 12100 }],
    [{ method: "manual_digital", tenderedMinor: 13000, changeMinor: 1000 }],
  ])(
    "EP03-T04 rejects invalid tender allocation %j without effects",
    async (tenders) => {
      const h = await harness();
      await h.open();
      const before = canonicalV2(h.state());
      await expect(h.apply("SALE", { ...sale(), tenders })).rejects.toThrow();
      expect(canonicalV2(h.state())).toBe(before);
    },
  );

  it("supports balanced split tenders and counts retained cash after change rather than cash handed over", async () => {
    const h = await harness();
    await h.open();
    await h.apply("SALE", {
      ...sale(),
      discountMinor: 1,
      tenders: [
        { method: "cash", tenderedMinor: 10000, changeMinor: 5000 },
        { method: "manual_digital", tenderedMinor: 6999, changeMinor: 0 },
      ],
    });
    expect(summaryV2(h.state())).toMatchObject({
      grossSalesMinor: 12000,
      discountsMinor: 1,
      netSalesMinor: 11999,
      netCashSalesMinor: 5000,
      netManualDigitalMinor: 6999,
      expectedCashMinor: 205000,
    });
  });

  it("EP03-T04 uses exact pack atoms and rejects fractional pieces, unrepresentable atoms and dimensions", async () => {
    const body = snapshotBody();
    const milk = body.items.find((item) => item.name === "milk")!;
    expect(
      packCountAtoms(milk, {
        packId: milk.packs[0]!.id,
        sealedPacks: 3,
        loose: "400",
        unit: "ml",
      }),
    ).toBe(3400000);
    expect(exactAtoms("0.001", milk, "ml")).toBe(1);
    expect(() => exactAtoms("0.0001", milk, "ml")).toThrow("FRACTIONAL_ATOM");
    expect(() => exactAtoms("0.5", { unit: "pc", atomScale: 1 }, "pc")).toThrow(
      "FRACTIONAL_ATOM",
    );
    expect(() => exactAtoms("1", milk, "g")).toThrow("UNIT_MISMATCH");
    for (const input of [NaN, Infinity, -1, "", "1e3", "1.0001"])
      expect(() =>
        exactAtoms(input, { unit: "pc", atomScale: 1 }, "pc"),
      ).toThrow();
    expect(() =>
      packCountAtoms(milk, {
        packId: milk.packs[0]!.id,
        sealedPacks: Number.MAX_SAFE_INTEGER,
        loose: 0,
        unit: "ml",
      }),
    ).toThrow();
  });

  it("EP03-T05 treats prepared cookie stock as a leaf even if an unrelated raw-production recipe exists", async () => {
    const body = snapshotBody();
    body.items.push({
      ...body.items[0]!,
      id: uuid(800),
      name: "raw_flour",
      packs: [],
    });
    body.recipes.push({
      id: uuid(801),
      ingredients: [{ kind: "item", itemId: uuid(800), atoms: 50000 }],
    });
    const snapshot = await createV2Snapshot(body, hash);
    const usage = consumeV2Lines(snapshot, lines("cookie_cup"));
    expect(usage.consumption).toEqual({
      [itemId("cookie_portions")]: 1,
      [itemId("ice_cream")]: 80000,
      [itemId("cups")]: 1,
      [itemId("spoons")]: 1,
    });
    expect(usage.consumption[uuid(800)]).toBeUndefined();
  });

  it("EP03-T06 refund of prepared sale reverses money only and cannot exceed remaining tender", async () => {
    const h = await harness();
    await h.open();
    await h.apply("SALE", sale());
    await prepTransition(h, uuid(700), "making", uuid(710));
    await prepTransition(h, uuid(700), "done", uuid(711));
    const consumed = { ...h.state().stockAtoms };
    await h.apply("REFUND", {
      saleId: uuid(700),
      amountMinor: 12000,
      method: "cash",
      reason: "Prepared drink refund",
    });
    expect(h.state().stockAtoms).toEqual(consumed);
    expect(summaryV2(h.state())).toMatchObject({
      netSalesMinor: 0,
      expectedCashMinor: 200000,
    });
    const before = canonicalV2(h.state());
    await expect(
      h.apply("REFUND", {
        saleId: uuid(700),
        amountMinor: 1,
        method: "cash",
        reason: "Too much",
      }),
    ).rejects.toThrow();
    await expect(
      h.apply("RETURN_UNPREPARED", {
        saleId: uuid(700),
        prepCommandId: uuid(712),
        prepConfirmedUnprepared: true,
        physicallyReturned: true,
        reason: "False prepared return",
      }),
    ).rejects.toThrow();
    expect(canonicalV2(h.state())).toBe(before);
  });

  it("EP03-T06 requires independently trusted prep evidence and returns unprepared stock only once", async () => {
    const h = await harness();
    await h.open();
    const opening = { ...h.state().stockAtoms };
    await h.apply("SALE", sale());
    const payload = {
      saleId: uuid(700),
      prepCommandId: uuid(712),
      prepConfirmedUnprepared: true,
      physicallyReturned: true,
      reason: "Verified physical return",
    };
    const consumed = canonicalV2(h.state());
    await expect(h.apply("RETURN_UNPREPARED", payload)).rejects.toThrow(
      "PREP_CONFIRMATION_REQUIRED",
    );
    expect(canonicalV2(h.state())).toBe(consumed);
    h.trust({
      commandId: uuid(712),
      saleId: uuid(700),
      prepInstallationId: uuid(7),
      action: "making",
    });
    await expect(h.apply("RETURN_UNPREPARED", payload)).rejects.toThrow(
      "PREP_CONFIRMATION_REQUIRED",
    );
    h.trust({
      commandId: uuid(712),
      saleId: uuid(700),
      prepInstallationId: uuid(7),
      action: "unprepared-return",
    });
    await h.apply("RETURN_UNPREPARED", payload);
    expect(h.state().stockAtoms).toEqual(opening);
    expect(h.state().orders[uuid(700)]?.prepState).toBe("cancelled");
    expect(summaryV2(h.state()).netSalesMinor).toBe(12000);
    await h.apply("RETURN_UNPREPARED", payload);
    expect(h.state().stockAtoms).toEqual(opening);
    await h.apply("REFUND", {
      saleId: uuid(700),
      amountMinor: 12000,
      method: "cash",
      reason: "Separate money return",
    });
    expect(summaryV2(h.state()).netSalesMinor).toBe(0);
  });

  it("rejects forged prep actions and never lets a delayed Start undo an accepted Done", async () => {
    const h = await harness();
    await h.open();
    await h.apply("SALE", sale());
    await expect(
      h.apply("PREP_TRANSITION", {
        saleId: uuid(700),
        commandId: uuid(710),
        prepInstallationId: uuid(7),
        next: "making",
      }),
    ).rejects.toThrow("PREP_CONFIRMATION_REQUIRED");
    const start = await prepTransition(h, uuid(700), "making", uuid(710));
    await prepTransition(h, uuid(700), "done", uuid(711));
    const repeated = await applyV2Operation(
      h.snapshot,
      h.state(),
      start,
      h.actor,
      hash,
    );
    expect(repeated.orders[uuid(700)]?.prepState).toBe("done");
    await h.apply("PREP_TRANSITION", {
      saleId: uuid(700),
      commandId: uuid(710),
      prepInstallationId: uuid(7),
      next: "making",
    });
    expect(h.state().orders[uuid(700)]?.prepState).toBe("done");
    await expect(
      prepTransition(h, uuid(700), "making", uuid(713)),
    ).rejects.toThrow("PREP_TRANSITION");
    expect(h.state().orders[uuid(700)]?.prepState).toBe("done");
  });

  it("never interprets an uncounted opening as zero or permits missing/duplicate opening items", async () => {
    const h = await harness();
    const before = canonicalV2(h.state());
    for (const counts of [
      h.counts.slice(1),
      [h.counts[0], ...h.counts.slice(0, -1)],
      [
        { itemId: h.counts[0]!.itemId, kind: "uncounted" },
        ...h.counts.slice(1),
      ],
    ]) {
      await expect(
        h.apply("OPEN_SHIFT", {
          counts,
          openingCashMinor: 200000,
          reviewed: true,
        }),
      ).rejects.toThrow();
      expect(canonicalV2(h.state())).toBe(before);
    }
  });

  it("applies modifiers and cash adjustments without inventing paid sales, and blocks overdrawn cash", async () => {
    const body = snapshotBody();
    body.products[1]!.modifierIds.push(uuid(850));
    body.modifiers.push({
      id: uuid(850),
      name: "Extra milk",
      priceMinor: 3000,
      ingredients: [{ kind: "item", itemId: itemId("milk"), atoms: 20000 }],
    });
    const h = await harness(body);
    await h.open();
    await h.apply("SALE", {
      ...sale(),
      lines: [
        {
          productId: productId("plain_matcha"),
          quantity: 1,
          modifierIds: [uuid(850)],
        },
      ],
      tenders: [{ method: "cash", tenderedMinor: 15000, changeMinor: 0 }],
    });
    await h.apply("CASH_ADJUSTMENT", {
      direction: "in",
      amountMinor: 1000,
      reason: "Paid in",
    });
    await h.apply("CASH_ADJUSTMENT", {
      direction: "out",
      amountMinor: 500,
      reason: "Paid out",
    });
    expect(summaryV2(h.state())).toMatchObject({
      netSalesMinor: 15000,
      expectedCashMinor: 215500,
    });
    expect(h.state().stockAtoms[itemId("milk")]).toBe(9830000);
    await expect(
      h.apply("CASH_ADJUSTMENT", {
        direction: "out",
        amountMinor: 215501,
        reason: "Too much",
      }),
    ).rejects.toThrow("INSUFFICIENT_CASH");
  });

  it("bounds a branching recipe graph instead of expanding a tiny input exponentially", async () => {
    const body = snapshotBody();
    body.recipes = Array.from({ length: 25 }, (_, index) => ({
      id: uuid(200 + index),
      ingredients:
        index === 24
          ? [{ kind: "item" as const, itemId: itemId("matcha"), atoms: 1 }]
          : [
              { kind: "recipe", recipeId: uuid(201 + index), quantity: 1 },
              { kind: "recipe", recipeId: uuid(201 + index), quantity: 1 },
            ],
    })) as unknown as typeof body.recipes;
    body.products = [body.products[0]!];
    // Either a validated complexity bound or memoized exact expansion is valid.
    try {
      const snapshot = await createV2Snapshot(body, hash);
      expect(
        consumeV2Lines(snapshot, lines("ube_matcha")).consumption[
          itemId("matcha")
        ],
      ).toBe(16777216);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toMatch(
        /(COMPLEX|EXPANSION|LIMIT|BUDGET)/,
      );
    }
  }, 2000);

  it("EP03-T07 rejects cyclic recipes and changed payload under an accepted operation ID", async () => {
    const body = snapshotBody();
    const cyclic = {
      ...body,
      recipes: [
        {
          id: uuid(200),
          ingredients: [{ kind: "recipe", recipeId: uuid(200), quantity: 1 }],
        },
        ...body.recipes.slice(1),
      ],
    };
    await expect(createV2Snapshot(cyclic, hash)).rejects.toThrow(
      "CYCLIC_RECIPE",
    );
    const h = await harness();
    await h.open();
    const accepted = await h.apply("SALE", sale());
    const changed = await sealV2Operation(
      {
        ...Object.fromEntries(
          Object.entries(accepted).filter(
            ([key]) => !["canonicalDigest", "authenticity"].includes(key),
          ),
        ),
        payload: { ...sale(), discountMinor: 1 },
      },
      auth,
      hash,
    );
    const before = canonicalV2(h.state());
    await expect(
      applyV2Operation(h.snapshot, h.state(), changed, h.actor, hash),
    ).rejects.toThrow();
    expect(canonicalV2(h.state())).toBe(before);
  });

  it.each([
    "businessId",
    "shiftId",
    "snapshotId",
    "snapshotHash",
    "installationId",
    "authorityEpoch",
  ])("rejects authorized-looking operation with wrong %s", async (field) => {
    const h = await harness();
    await h.open();
    const value =
      field === "authorityEpoch"
        ? 2
        : field === "snapshotHash"
          ? "b".repeat(64)
          : uuid(999);
    const forged = await h.operation("SALE", sale(), { [field]: value });
    const before = canonicalV2(h.state());
    await expect(
      applyV2Operation(h.snapshot, h.state(), forged, h.actor, hash),
    ).rejects.toThrow();
    expect(canonicalV2(h.state())).toBe(before);
  });

  it("rejects a prep identity attempting a canonical financial write", async () => {
    const h = await harness();
    await h.open();
    const operation = await h.operation("SALE", sale());
    await expect(
      applyV2Operation(
        h.snapshot,
        h.state(),
        operation,
        { ...h.actor, role: "prep", installationId: uuid(7) },
        hash,
      ),
    ).rejects.toThrow();
  });

  it("rejects future sequence until missing predecessor arrives, preserving the original state", async () => {
    const h = await harness();
    await h.open();
    const before = canonicalV2(h.state());
    const future = await h.operation("SALE", sale(), { sequence: 3 });
    await expect(
      applyV2Operation(h.snapshot, h.state(), future, h.actor, hash),
    ).rejects.toThrow();
    expect(canonicalV2(h.state())).toBe(before);
  });

  it("rejects overselling and integer-overflow effects without changing stock or totals", async () => {
    const h = await harness();
    await h.open();
    const before = canonicalV2(h.state());
    await expect(h.apply("SALE", sale(uuid(700), 10000))).rejects.toThrow();
    await expect(
      h.apply("RESTOCK", {
        itemId: itemId("milk"),
        atoms: Number.MAX_SAFE_INTEGER,
        reason: "Overflow",
      }),
    ).rejects.toThrow();
    expect(canonicalV2(h.state())).toBe(before);
  });

  it("closes with a matching manifest while retaining null cash/unverified stock counts", async () => {
    const h = await harness();
    await golden(h);
    const summary = summaryV2(h.state());
    await h.apply("CLOSE_SHIFT", {
      manifestId: uuid(900),
      lastFinancialSequence: h.state().lastSequence,
      journalDigest: await journalDigestV2(h.state(), hash),
      expectedCashMinor: 240000,
      netSalesMinor: 52000,
      expectedStockAtoms: summary.stockAtoms,
      actualCashMinor: null,
      counts: itemNames.map((name) => ({
        itemId: itemId(name),
        kind: "uncounted",
      })),
      pendingAttachmentIds: [uuid(901)],
      manualResolutions: [],
    });
    expect(h.state().state).toBe("closed");
    expect(h.state().closing?.actualCashMinor).toBeNull();
    expect(
      h.state().closing?.counts.every((count) => count.kind === "uncounted"),
    ).toBe(true);
    await expect(h.apply("SALE", sale())).rejects.toThrow();
  });

  it("uses deterministic seed 1337 to check independent money/stock conservation across 120 mixed tenders and refunds", async () => {
    const h = await harness(snapshotBody(), 100);
    await h.open();
    let seed = 1337,
      totalQuantity = 0,
      gross = 0,
      refunds = 0,
      netCash = 0,
      netDigital = 0;
    for (let index = 0; index < 120; index++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const quantity = (seed % 3) + 1,
        total = quantity * 12000,
        method = seed & 1 ? "cash" : "manual_digital",
        saleId = uuid(10000 + index);
      const applied = await h.apply("SALE", {
        ...sale(saleId, quantity),
        tenders: [{ method, tenderedMinor: total, changeMinor: 0 }],
      });
      totalQuantity += quantity;
      gross += total;
      if (method === "cash") netCash += total;
      else netDigital += total;
      expect(
        await applyV2Operation(h.snapshot, h.state(), applied, h.actor, hash),
      ).toEqual(h.state());
      if (index % 4 === 0) {
        await h.apply("REFUND", {
          saleId,
          amountMinor: total,
          method,
          reason: "Seeded refund without material return",
        });
        refunds += total;
        if (method === "cash") netCash -= total;
        else netDigital -= total;
      }
      expect(
        Object.values(h.state().stockAtoms).every(
          (value) => Number.isSafeInteger(value) && value >= 0,
        ),
      ).toBe(true);
    }
    expect(summaryV2(h.state())).toMatchObject({
      grossSalesMinor: gross,
      refundsMinor: refunds,
      netSalesMinor: gross - refunds,
      netCashSalesMinor: netCash,
      netManualDigitalMinor: netDigital,
      expectedCashMinor: 200000 + netCash,
    });
    expect(h.state().stockAtoms[itemId("matcha")]).toBe(
      100000000 - totalQuantity * 4000,
    );
    expect(h.state().stockAtoms[itemId("milk")]).toBe(
      1000000000 - totalQuantity * 150000,
    );
    expect(h.state().stockAtoms[itemId("cups")]).toBe(10000 - totalQuantity);
  });
});
