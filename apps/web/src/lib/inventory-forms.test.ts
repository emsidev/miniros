import { describe, expect, it } from "vitest";
import {
  adjustmentDelta,
  newAdjustmentDraft,
  newCashDraft,
  newMovementDraft,
  newMovementLine,
  positiveAmount,
  validateAdjustmentDraft,
  validateCashDraft,
  validateMovementDraft,
} from "./inventory-forms";
import { historyPage, selectInventoryShift } from "./inventory-workspace";

describe("inventory form input", () => {
  it("converts a positive expression and explicit direction to a signed quantity", () => {
    expect(adjustmentDelta("add", "1 + 2.125")).toBe(3.125);
    expect(adjustmentDelta("remove", "1 + 2.125")).toBe(-3.125);
    for (const quantity of ["", "-3", "0", "0.00001", "1/0", "not a quantity"])
      expect(adjustmentDelta("remove", quantity)).toBeNull();
    expect(positiveAmount("12.345", 2)).toBe(12.35);
    expect(positiveAmount("999999999999", 3)).toBeNull();
  });
  it("requires a cash purpose and positive amount, but not notes", () => {
    expect(validateCashDraft(newCashDraft()).map((error) => error.id)).toEqual([
      "cash-purpose",
      "cash-amount",
    ]);
    expect(
      validateCashDraft({
        ...newCashDraft(),
        label: "Ice",
        amount: "100 + 25",
      }),
    ).toEqual([]);
  });
  it("validates stock availability without blocking approval requests", () => {
    const draft = {
      ...newAdjustmentDraft(),
      inventoryItemId: "cup",
      quantity: "3",
      reason: "Damaged",
      direction: "remove" as const,
    };
    const items = [{ inventoryItemId: "cup", quantityOnHand: "2.000" }];
    expect(validateAdjustmentDraft(draft, items, false)[0]?.id).toBe(
      "adjustment-quantity",
    );
    expect(validateAdjustmentDraft(draft, items, true)).toEqual([]);
    expect(
      validateAdjustmentDraft({ ...draft, direction: "add" }, items, false),
    ).toEqual([]);
    expect(validateAdjustmentDraft(draft, [], false)[0]?.id).toBe(
      "adjustment-item",
    );
  });
  it("validates a multi-item batch and rejects duplicate items or the same destination", () => {
    const locations = [{ id: "a" }, { id: "b" }];
    const items = [{ id: "cup" }, { id: "milk" }];
    const draft = {
      ...newMovementDraft(),
      locationId: "a",
      fromLocationId: "a",
      toLocationId: "b",
      lines: [
        { ...newMovementLine(), inventoryItemId: "cup", quantity: "5+5" },
        { ...newMovementLine(), inventoryItemId: "milk", quantity: "1.125" },
      ],
    };
    expect(validateMovementDraft(draft, "receive", locations, items)).toEqual(
      [],
    );
    expect(validateMovementDraft(draft, "transfer", locations, items)).toEqual(
      [],
    );
    expect(
      validateMovementDraft(
        { ...draft, toLocationId: "a" },
        "transfer",
        locations,
        items,
      )[0]?.id,
    ).toBe("transfer-to");
    expect(
      validateMovementDraft(
        {
          ...draft,
          lines: [
            draft.lines[0]!,
            { ...draft.lines[1]!, inventoryItemId: "cup" },
          ],
        },
        "receive",
        locations,
        items,
      )[0]?.message,
    ).toContain("already has a row");
    expect(
      validateMovementDraft(
        { ...draft, lines: [] },
        "receive",
        locations,
        items,
      )[0]?.id,
    ).toBe("movement-lines");
    expect(
      validateMovementDraft(
        {
          ...draft,
          lines: Array.from({ length: 101 }, () => newMovementLine()),
        },
        "receive",
        locations,
        items,
      )[0]?.id,
    ).toBe("movement-lines");
  });
});

describe("inventory shift selection", () => {
  const shift = (
    id: string,
    status: string,
    shiftDate: string,
    assignmentStatus = "assigned",
  ) => ({
    id,
    status,
    shiftDate,
    assignmentStatus,
    title: null,
    locationName: "Booth",
    createdAt: new Date(shiftDate),
  });
  const shifts = [
    shift("past", "closed", "2026-09-05", "completed"),
    shift("closing", "closing", "2026-09-04"),
    shift("active", "active", "2026-09-01"),
    shift("newer-active", "active", "2026-09-02"),
  ];
  it("prefers active, then closing, then latest closed shifts", () => {
    expect(selectInventoryShift(shifts).selected?.id).toBe("newer-active");
    expect(selectInventoryShift(shifts.slice(0, 2)).selected?.id).toBe(
      "closing",
    );
    expect(selectInventoryShift(shifts.slice(0, 1)).selected?.id).toBe("past");
  });
  it("honors explicit history and does not fall back from invalid selections", () => {
    expect(selectInventoryShift(shifts, "past").selected?.id).toBe("past");
    expect(selectInventoryShift(shifts, "missing").selected).toBeNull();
    expect(selectInventoryShift(shifts, "").selected).toBeNull();
    expect(
      selectInventoryShift([
        shift("cancelled", "active", "2026-09-01", "cancelled"),
        shift("future", "scheduled", "2026-09-09"),
        shift("done", "active", "2026-09-01", "completed"),
      ]).options,
    ).toEqual([]);
    expect(historyPage("-1")).toBe(1);
    expect(historyPage("NaN")).toBe(1);
  });
});
