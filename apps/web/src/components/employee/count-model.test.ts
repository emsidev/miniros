import { describe, expect, it } from "vitest";
import {
  countsPayload,
  initialCounts,
  validateCash,
  validateCounts,
} from "./count-model";
const items = [
  { id: "cups", name: "Cups", unit: "pcs", initialQuantity: "12.500" },
  { id: "milk", name: "Milk", unit: "litres", initialQuantity: "0" },
];
describe("employee count data", () => {
  it("retains defaults and includes every item in the payload regardless of search visibility", () => {
    const values = { ...initialCounts(items), cups: "12 + 6", milk: "1 / 3" };
    expect(validateCounts(items, values)).toEqual([]);
    expect(countsPayload(items, values)).toEqual([
      { inventoryItemId: "cups", quantity: "18.000" },
      { inventoryItemId: "milk", quantity: "0.333" },
    ]);
    expect(initialCounts(items).cups).toBe("12.500");
  });
  it("identifies empty, negative, and invalid counts with field targets", () => {
    expect(
      validateCounts(items, { cups: "", milk: "-1" }).map((error) => error.id),
    ).toEqual(["count-cups", "count-milk"]);
    expect(validateCounts(items, { cups: "1/0", milk: "0" })[0].message).toBe(
      "Cannot divide by zero.",
    );
  });
  it("accepts zero cash but requires an explicit finite nonnegative amount", () => {
    expect(validateCash("0")).toEqual([]);
    expect(validateCash("100 + 50.25")).toEqual([]);
    for (const value of ["", "-0.01", "1/0", "10+"])
      expect(validateCash(value)[0].id).toBe("actualCash");
  });
});
