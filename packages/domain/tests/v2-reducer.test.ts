import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  canonicalV2,
  createV2Snapshot,
  journalDigestV2,
  sealV2Operation,
} from "../src/v2/core";
import {
  applyV2Operation,
  initialV2Projection,
  summaryV2,
} from "../src/v2/reducer";
import {
  v2Kinds,
  type V2Actor,
  type V2Kind,
  type V2OperationBody,
  type V2Payloads,
  type V2Projection,
  type V2Snapshot,
} from "../src/v2/types";
const id = (number: number) =>
  `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const ids = {
  business: id(1),
  shift: id(2),
  snapshot: id(3),
  cashier: id(4),
  prep: id(5),
  milk: id(10),
  cookie: id(11),
  flour: id(12),
  cup: id(13),
  drink: id(20),
  cookieProduct: id(21),
  modifier: id(30),
  sale: id(40),
};
const hash = async (value: string) =>
  createHash("sha256").update(value).digest("hex");
const authenticity = {
  scheme: "ed25519" as const,
  grantId: id(6),
  signature: "A".repeat(86) + "==",
};
const actor: V2Actor = {
  businessId: ids.business,
  shiftId: ids.shift,
  installationId: ids.cashier,
  cashierInstallationId: ids.cashier,
  authorityEpoch: 1,
  role: "cashier",
  allowedKinds: v2Kinds,
};
const line = (quantity = 1) => ({
  productId: ids.drink,
  quantity,
  modifierIds: [],
});
const sale = (quantity = 1): V2Payloads["SALE"] => ({
  saleId: ids.sale,
  lines: [line(quantity)],
  discountMinor: 0,
  tenders: [{ method: "cash", tenderedMinor: 500 * quantity, changeMinor: 0 }],
});
async function fixture(): Promise<V2Snapshot> {
  return createV2Snapshot(
    {
      schemaVersion: 2,
      id: ids.snapshot,
      businessId: ids.business,
      shiftId: ids.shift,
      version: 1,
      catalogVersion: "catalog1",
      recipeVersion: "recipes1",
      costingVersion: "costs1",
      checklist: { id: id(7), version: 1, entries: [] },
      items: [
        {
          id: ids.milk,
          name: "Milk",
          category: "Ingredients",
          unit: "ml",
          atomScale: 1,
          prepared: false,
          unitCostMinor: 1,
          packs: [],
        },
        {
          id: ids.cookie,
          name: "Prepared cookie",
          category: "Prepared",
          unit: "pc",
          atomScale: 1,
          prepared: true,
          unitCostMinor: 100,
          packs: [],
        },
        {
          id: ids.flour,
          name: "Flour",
          category: "Ingredients",
          unit: "g",
          atomScale: 1000,
          prepared: false,
          unitCostMinor: 1,
          packs: [],
        },
        {
          id: ids.cup,
          name: "Cup",
          category: "Packaging",
          unit: "pc",
          atomScale: 1,
          prepared: false,
          unitCostMinor: 10,
          packs: [],
        },
      ],
      recipes: [
        {
          id: id(50),
          ingredients: [
            { kind: "item", itemId: ids.milk, atoms: 100 },
            { kind: "item", itemId: ids.cup, atoms: 1 },
          ],
        },
        {
          id: id(51),
          ingredients: [
            { kind: "item", itemId: ids.cookie, atoms: 1 },
            { kind: "item", itemId: ids.cup, atoms: 1 },
          ],
        },
      ],
      products: [
        {
          id: ids.drink,
          name: "Drink",
          priceMinor: 500,
          costMinor: 110,
          recipeId: id(50),
          modifierIds: [ids.modifier],
        },
        {
          id: ids.cookieProduct,
          name: "Cookie cup",
          priceMinor: 300,
          costMinor: 110,
          recipeId: id(51),
          modifierIds: [],
        },
      ],
      modifiers: [
        {
          id: ids.modifier,
          name: "Extra milk",
          priceMinor: 50,
          ingredients: [{ kind: "item", itemId: ids.milk, atoms: 10 }],
        },
      ],
    },
    hash,
  );
}
async function make<K extends V2Kind>(
  snapshot: V2Snapshot,
  kind: K,
  payload: V2Payloads[K],
  sequence: number,
  overrides: Partial<V2OperationBody> = {},
) {
  return sealV2Operation(
    {
      protocolVersion: 2,
      schemaVersion: 2,
      operationId: id(100 + sequence),
      businessId: snapshot.businessId,
      shiftId: snapshot.shiftId,
      snapshotId: snapshot.id,
      snapshotHash: snapshot.hash,
      installationId: ids.cashier,
      authorityEpoch: 1,
      sequence,
      occurredAt: "2026-09-07T09:00:00.000Z",
      kind,
      payload,
      ...overrides,
    },
    authenticity,
    hash,
  );
}
async function dispatch<K extends V2Kind>(
  snapshot: V2Snapshot,
  state: V2Projection,
  kind: K,
  payload: V2Payloads[K],
  context = actor,
) {
  return applyV2Operation(
    snapshot,
    state,
    await make(snapshot, kind, payload, state.lastSequence + 1),
    context,
    hash,
  );
}
async function opened(snapshot: V2Snapshot) {
  return dispatch(
    snapshot,
    initialV2Projection(snapshot, actor),
    "OPEN_SHIFT",
    {
      reviewed: true,
      openingCashMinor: 1000,
      counts: [
        { itemId: ids.milk, kind: "counted", atoms: 1000 },
        { itemId: ids.cookie, kind: "counted", atoms: 4 },
        { itemId: ids.flour, kind: "counted", atoms: 10_000 },
        { itemId: ids.cup, kind: "counted", atoms: 20 },
      ],
    },
  );
}
async function manifest(
  state: V2Projection,
): Promise<V2Payloads["CLOSE_SHIFT"]> {
  const totals = summaryV2(state);
  return {
    manifestId: id(90),
    lastFinancialSequence: state.lastSequence,
    journalDigest: await journalDigestV2(state, hash),
    expectedCashMinor: totals.expectedCashMinor,
    netSalesMinor: totals.netSalesMinor,
    expectedStockAtoms: totals.stockAtoms,
    actualCashMinor: null,
    counts: Object.keys(state.stockAtoms).map((itemId) => ({
      itemId,
      kind: "uncounted",
    })),
    pendingAttachmentIds: [id(91)],
    manualResolutions: Object.values(state.orders)
      .filter((order) => ["new", "making"].includes(order.prepState))
      .map((order) => ({
        saleId: order.saleId,
        reason: "Recorded physical handover; verify remaining work manually.",
      })),
  };
}

describe("EP03 pure cashier journal reducer", () => {
  it("initializes only a frozen shift projection, without mutating the snapshot or actor", async () => {
    const snapshot = await fixture();
    const initial = initialV2Projection(snapshot, actor);
    expect(initial.state).toBe("unopened");
    expect(initial.stockAtoms).toEqual({
      [ids.milk]: 0,
      [ids.cookie]: 0,
      [ids.flour]: 0,
      [ids.cup]: 0,
    });
    expect(Object.isFrozen(initial.stockAtoms)).toBe(true);
    expect(actor.authorityEpoch).toBe(1);
  });
  it("requires complete, resolved opening observations, preserving explicit zero and Not brought", async () => {
    const snapshot = await fixture();
    const state = initialV2Projection(snapshot, actor);
    const counts = snapshot.items.map((item) => ({
      itemId: item.id,
      kind: "not-brought" as const,
    }));
    await expect(
      dispatch(snapshot, state, "OPEN_SHIFT", {
        reviewed: true,
        openingCashMinor: 0,
        counts: counts.slice(1),
      }),
    ).rejects.toThrow("INCOMPLETE_COUNTS");
    await expect(
      dispatch(snapshot, state, "OPEN_SHIFT", {
        reviewed: true,
        openingCashMinor: 0,
        counts: counts.map((count, index) =>
          index ? count : { itemId: count.itemId, kind: "uncounted" },
        ),
      }),
    ).rejects.toThrow("UNCOUNTED_OPENING");
    const result = await dispatch(snapshot, state, "OPEN_SHIFT", {
      reviewed: true,
      openingCashMinor: 0,
      counts: counts.map((count, index) =>
        index ? count : { itemId: count.itemId, kind: "counted", atoms: 0 },
      ),
    });
    expect(result.stockAtoms[ids.milk]).toBe(0);
    expect(result.stockAtoms[ids.cookie]).toBe(0);
    expect(state.state).toBe("unopened");
  });
  it("retains only cash after change and uses snapshot price, modifiers and consumption", async () => {
    const snapshot = await fixture();
    const before = await opened(snapshot);
    const result = await dispatch(snapshot, before, "SALE", {
      ...sale(2),
      lines: [{ ...line(2), modifierIds: [ids.modifier] }],
      discountMinor: 100,
      tenders: [
        { method: "cash", tenderedMinor: 800, changeMinor: 200 },
        { method: "manual_digital", tenderedMinor: 400, changeMinor: 0 },
      ],
    });
    expect(summaryV2(result)).toMatchObject({
      grossSalesMinor: 1100,
      discountsMinor: 100,
      netSalesMinor: 1000,
      netCashSalesMinor: 600,
      netManualDigitalMinor: 400,
      expectedCashMinor: 1600,
    });
    expect(result.stockAtoms).toEqual({
      [ids.milk]: 780,
      [ids.cookie]: 4,
      [ids.flour]: 10_000,
      [ids.cup]: 18,
    });
    expect(before.stockAtoms[ids.milk]).toBe(1000);
    expect(Object.isFrozen(result.orders[ids.sale]?.lines[0])).toBe(true);
  });
  it.each([
    { discountMinor: 501, expected: "EXCESS_DISCOUNT" },
    {
      tenders: [{ method: "cash", tenderedMinor: 501, changeMinor: 0 }],
      expected: "TENDER_MISMATCH",
    },
    {
      tenders: [{ method: "cash", tenderedMinor: 100, changeMinor: 101 }],
      expected: "INVALID_CHANGE",
    },
    {
      tenders: [
        { method: "manual_digital", tenderedMinor: 600, changeMinor: 100 },
      ],
      expected: "INVALID_CHANGE",
    },
  ])(
    "rejects invalid tender/discount atomically ($expected)",
    async (entry) => {
      const snapshot = await fixture();
      const state = await opened(snapshot);
      const original = canonicalV2(state);
      const { expected, ...change } = entry;
      await expect(
        dispatch(snapshot, state, "SALE", {
          ...sale(),
          ...change,
        } as V2Payloads["SALE"]),
      ).rejects.toThrow(expected);
      expect(canonicalV2(state)).toBe(original);
    },
  );
  it("rejects overselling without spending unrelated ingredients or retaining a payment", async () => {
    const snapshot = await fixture();
    const state = await opened(snapshot);
    await expect(dispatch(snapshot, state, "SALE", sale(11))).rejects.toThrow(
      "INSUFFICIENT_STOCK",
    );
    expect(state.stockAtoms[ids.cup]).toBe(20);
    expect(state.grossSalesMinor).toBe(0);
  });
  it("treats a prepared portion as a leaf, without consuming raw production materials again", async () => {
    const snapshot = await fixture();
    const state = await opened(snapshot);
    const result = await dispatch(snapshot, state, "SALE", {
      ...sale(),
      lines: [{ productId: ids.cookieProduct, quantity: 1, modifierIds: [] }],
      tenders: [{ method: "cash", tenderedMinor: 300, changeMinor: 0 }],
    });
    expect(result.stockAtoms[ids.cookie]).toBe(3);
    expect(result.stockAtoms[ids.flour]).toBe(10_000);
    expect(result.stockAtoms[ids.cup]).toBe(19);
  });
  it("deduplicates original operations before sequence/state guards, but rejects changed payload under the same ID", async () => {
    const snapshot = await fixture();
    const state = await opened(snapshot);
    const operation = await make(snapshot, "SALE", sale(), 2);
    const sold = await applyV2Operation(
      snapshot,
      state,
      operation,
      actor,
      hash,
    );
    expect(
      await applyV2Operation(snapshot, sold, operation, actor, hash),
    ).toEqual(sold);
    const altered = await make(
      snapshot,
      "SALE",
      { ...sale(), discountMinor: 1 },
      2,
    );
    await expect(
      applyV2Operation(snapshot, sold, altered, actor, hash),
    ).rejects.toThrow("OPERATION_CONFLICT");
  });
  it("orders by sequence rather than a device clock, and rejects missing sequence", async () => {
    const snapshot = await fixture();
    const state = await opened(snapshot);
    const backwardClock = await make(snapshot, "SALE", sale(), 2, {
      occurredAt: "2020-01-01T00:00:00.000Z",
    });
    expect(
      (await applyV2Operation(snapshot, state, backwardClock, actor, hash))
        .lastSequence,
    ).toBe(2);
    await expect(
      applyV2Operation(
        snapshot,
        state,
        await make(snapshot, "SALE", sale(), 3),
        actor,
        hash,
      ),
    ).rejects.toThrow("SEQUENCE_GAP");
  });
  it("bounds each refund by that sale's retained tender and never returns stock", async () => {
    const snapshot = await fixture();
    const state = await opened(snapshot);
    const sold = await dispatch(snapshot, state, "SALE", {
      ...sale(2),
      tenders: [
        { method: "cash", tenderedMinor: 800, changeMinor: 200 },
        { method: "manual_digital", tenderedMinor: 400, changeMinor: 0 },
      ],
    });
    await expect(
      dispatch(snapshot, sold, "REFUND", {
        saleId: ids.sale,
        amountMinor: 601,
        method: "cash",
        reason: "Too much",
      }),
    ).rejects.toThrow("REFUND_EXCEEDS_TENDER");
    const refund = await dispatch(snapshot, sold, "REFUND", {
      saleId: ids.sale,
      amountMinor: 400,
      method: "manual_digital",
      reason: "Drink refunded",
    });
    expect(refund.stockAtoms).toEqual(sold.stockAtoms);
    expect(summaryV2(refund)).toMatchObject({
      netSalesMinor: 600,
      netManualDigitalMinor: 0,
      netCashSalesMinor: 600,
      expectedCashMinor: 1600,
    });
    await expect(
      dispatch(snapshot, refund, "REFUND", {
        saleId: ids.sale,
        amountMinor: 1,
        method: "manual_digital",
        reason: "Second refund",
      }),
    ).rejects.toThrow("REFUND_EXCEEDS_TENDER");
  });
  it("records complimentary and remake consumption without extra revenue, with remake bounded to original lines", async () => {
    const snapshot = await fixture();
    let state = await opened(snapshot);
    state = await dispatch(snapshot, state, "SALE", sale(2));
    state = await dispatch(snapshot, state, "COMPLIMENTARY", {
      lines: [line()],
      reason: "Staff drink",
    });
    state = await dispatch(snapshot, state, "REMAKE", {
      saleId: ids.sale,
      lines: [line()],
      reason: "Spilled original",
    });
    expect(state.grossSalesMinor).toBe(1000);
    expect(state.stockAtoms[ids.milk]).toBe(600);
    expect(state.complimentaryItemQuantity).toBe(1);
    expect(state.remadeItemQuantity).toBe(1);
    await expect(
      dispatch(snapshot, state, "REMAKE", {
        saleId: ids.sale,
        lines: [line(3)],
        reason: "Too many",
      }),
    ).rejects.toThrow("REMAKE_EXCEEDS_ORIGINAL");
    await expect(
      dispatch(snapshot, state, "REMAKE", {
        saleId: ids.sale,
        lines: [{ ...line(), modifierIds: [ids.modifier] }],
        reason: "Different modifier",
      }),
    ).rejects.toThrow("REMAKE_EXCEEDS_ORIGINAL");
  });
  it("requires adapter-verified prep evidence for a full unprepared return and restores stock only once", async () => {
    const snapshot = await fixture();
    const state = await opened(snapshot);
    const sold = await dispatch(snapshot, state, "SALE", sale(2));
    const payload: V2Payloads["RETURN_UNPREPARED"] = {
      saleId: ids.sale,
      prepCommandId: id(60),
      prepConfirmedUnprepared: true,
      physicallyReturned: true,
      reason: "Physically returned before preparation",
    };
    await expect(
      dispatch(snapshot, sold, "RETURN_UNPREPARED", payload),
    ).rejects.toThrow("PREP_CONFIRMATION_REQUIRED");
    const context: V2Actor = {
      ...actor,
      verifiedPrepCommands: [
        {
          commandId: id(60),
          saleId: ids.sale,
          prepInstallationId: ids.prep,
          action: "unprepared-return",
        },
      ],
    };
    const returned = await dispatch(
      snapshot,
      sold,
      "RETURN_UNPREPARED",
      payload,
      context,
    );
    expect(returned.stockAtoms).toEqual(state.stockAtoms);
    expect(returned.grossSalesMinor).toBe(1000);
    expect(returned.refundsMinor).toBe(0);
    expect(returned.orders[ids.sale]?.prepState).toBe("cancelled");
    const repeated = await dispatch(
      snapshot,
      returned,
      "RETURN_UNPREPARED",
      payload,
      context,
    );
    expect(repeated.stockAtoms).toEqual(returned.stockAtoms);
    const secondContext: V2Actor = {
      ...actor,
      verifiedPrepCommands: [
        {
          commandId: id(61),
          saleId: ids.sale,
          prepInstallationId: ids.prep,
          action: "unprepared-return",
        },
      ],
    };
    await expect(
      dispatch(
        snapshot,
        repeated,
        "RETURN_UNPREPARED",
        { ...payload, prepCommandId: id(61) },
        secondContext,
      ),
    ).rejects.toThrow("ORDER_ALREADY_PREPARED");
  });
  it("accepts authenticated prep new→making→done; an old stable Start cannot undo Done", async () => {
    const snapshot = await fixture();
    let state = await dispatch(
      snapshot,
      await opened(snapshot),
      "SALE",
      sale(),
    );
    const context: V2Actor = {
      ...actor,
      verifiedPrepCommands: [
        {
          commandId: id(70),
          saleId: ids.sale,
          prepInstallationId: ids.prep,
          action: "making",
        },
        {
          commandId: id(71),
          saleId: ids.sale,
          prepInstallationId: ids.prep,
          action: "done",
        },
      ],
    };
    const making: V2Payloads["PREP_TRANSITION"] = {
      saleId: ids.sale,
      commandId: id(70),
      prepInstallationId: ids.prep,
      next: "making",
    };
    const done: V2Payloads["PREP_TRANSITION"] = {
      ...making,
      commandId: id(71),
      next: "done",
    };
    await expect(
      dispatch(snapshot, state, "PREP_TRANSITION", done, context),
    ).rejects.toThrow("PREP_TRANSITION");
    state = await dispatch(snapshot, state, "PREP_TRANSITION", making, context);
    state = await dispatch(snapshot, state, "PREP_TRANSITION", done, context);
    const repeatedStart = await dispatch(
      snapshot,
      state,
      "PREP_TRANSITION",
      making,
      context,
    );
    expect(repeatedStart.orders[ids.sale]?.prepState).toBe("done");
    const returnedContext: V2Actor = {
      ...actor,
      verifiedPrepCommands: [
        {
          commandId: id(72),
          saleId: ids.sale,
          prepInstallationId: ids.prep,
          action: "unprepared-return",
        },
      ],
    };
    await expect(
      dispatch(
        snapshot,
        repeatedStart,
        "RETURN_UNPREPARED",
        {
          saleId: ids.sale,
          prepCommandId: id(72),
          prepConfirmedUnprepared: true,
          physicallyReturned: true,
          reason: "Already made",
        },
        returnedContext,
      ),
    ).rejects.toThrow("ORDER_ALREADY_PREPARED");
  });
  it("retains explicit stock adjustments and cash in/out, never silently permitting negative stock/cash", async () => {
    const snapshot = await fixture();
    let state = await opened(snapshot);
    state = await dispatch(snapshot, state, "RESTOCK", {
      itemId: ids.milk,
      atoms: 200,
      reason: "Delivered",
    });
    state = await dispatch(snapshot, state, "WASTE", {
      itemId: ids.milk,
      atoms: 100,
      reason: "Spilled",
    });
    const adjustment = {
      itemId: ids.milk,
      deltaAtoms: -20,
      reason: "Verified recount",
      approvalId: id(80),
    };
    await expect(
      dispatch(snapshot, state, "ADJUST_STOCK", adjustment),
    ).rejects.toThrow("STOCK_APPROVAL_REQUIRED");
    state = await dispatch(snapshot, state, "ADJUST_STOCK", adjustment, {
      ...actor,
      verifiedStockApprovals: [
        {
          approvalId: id(80),
          operationId: id(104),
          itemId: ids.milk,
          deltaAtoms: -20,
        },
      ],
    });
    state = await dispatch(snapshot, state, "CASH_ADJUSTMENT", {
      direction: "in",
      amountMinor: 50,
      reason: "Additional float",
    });
    state = await dispatch(snapshot, state, "CASH_ADJUSTMENT", {
      direction: "out",
      amountMinor: 20,
      reason: "Authorized booth cost",
    });
    expect(state.stockAtoms[ids.milk]).toBe(1080);
    expect(summaryV2(state).expectedCashMinor).toBe(1030);
    await expect(
      dispatch(snapshot, state, "WASTE", {
        itemId: ids.milk,
        atoms: 1081,
        reason: "Too much",
      }),
    ).rejects.toThrow("INSUFFICIENT_STOCK");
    await expect(
      dispatch(snapshot, state, "CASH_ADJUSTMENT", {
        direction: "out",
        amountMinor: 1031,
        reason: "Too much",
      }),
    ).rejects.toThrow("INSUFFICIENT_CASH");
  });
  it.each(["business", "installation", "epoch", "role", "permission"])(
    "rejects an untrusted actor mismatch: %s",
    async (field) => {
      const snapshot = await fixture();
      const state = await opened(snapshot);
      const bad: V2Actor = {
        ...actor,
        ...(field === "business"
          ? { businessId: id(999) }
          : field === "installation"
            ? { installationId: ids.prep }
            : field === "epoch"
              ? { authorityEpoch: 2 }
              : field === "role"
                ? { role: "prep" as const }
                : { allowedKinds: [] }),
      };
      await expect(
        dispatch(snapshot, state, "SALE", sale(), bad),
      ).rejects.toThrow();
      expect(state.lastSequence).toBe(1);
    },
  );
  it("closes against the pre-close journal and exact balances, preserving unverified counts and pending attachments", async () => {
    const snapshot = await fixture();
    const state = await dispatch(
      snapshot,
      await opened(snapshot),
      "SALE",
      sale(),
    );
    const payload = await manifest(state);
    await expect(
      dispatch(snapshot, state, "CLOSE_SHIFT", {
        ...payload,
        manualResolutions: [],
      }),
    ).rejects.toThrow("UNRESOLVED_ORDERS");
    await expect(
      dispatch(snapshot, state, "CLOSE_SHIFT", {
        ...payload,
        expectedCashMinor: payload.expectedCashMinor + 1,
      }),
    ).rejects.toThrow("CLOSE_BALANCE_MISMATCH");
    await expect(
      dispatch(snapshot, state, "CLOSE_SHIFT", {
        ...payload,
        journalDigest: "0".repeat(64),
      }),
    ).rejects.toThrow("CLOSE_JOURNAL_MISMATCH");
    const operation = await make(
      snapshot,
      "CLOSE_SHIFT",
      payload,
      state.lastSequence + 1,
    );
    const closed = await applyV2Operation(
      snapshot,
      state,
      operation,
      actor,
      hash,
    );
    expect(closed.state).toBe("closed");
    expect(closed.closing?.counts).toEqual(payload.counts);
    expect(closed.closing?.actualCashMinor).toBeNull();
    expect(closed.closing?.pendingAttachmentIds).toEqual([id(91)]);
    expect(
      await applyV2Operation(snapshot, closed, operation, actor, hash),
    ).toEqual(closed);
    await expect(
      dispatch(snapshot, closed, "RESTOCK", {
        itemId: ids.milk,
        atoms: 1,
        reason: "Late",
      }),
    ).rejects.toThrow("SHIFT_CLOSED");
  });
});
