import { describe, expect, it } from "vitest";
import { inventoryUnitValues, inventoryUnits } from "../src/constants";

describe("inventory unit options", () => {
  it("publishes exactly the supported canonical unit values", () => {
    expect(inventoryUnitValues).toEqual([
      "pcs",
      "pack",
      "box",
      "bottle",
      "cup",
      "g",
      "kg",
      "ml",
      "l",
    ]);
    expect(inventoryUnits.map((unit) => unit.value)).toEqual(
      inventoryUnitValues,
    );
    expect(inventoryUnitValues).not.toContain("tray");
  });
});
