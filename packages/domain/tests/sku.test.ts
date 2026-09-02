import { describe, expect, it } from "vitest";
import {
  formatAutomaticSku,
  normalizeSku,
  selectAvailableAutomaticSku,
  skuNameSegment,
} from "../src/sku";

describe("catalog SKU utilities", () => {
  it("normalizes readable SKU name segments", () => {
    expect(skuNameSegment("Egg Brûlée Matcha")).toBe("EGG-BRULEE-MATCHA");
    expect(skuNameSegment("   ")).toBe("ITEM");
    expect(normalizeSku("  prd-matcha-1a2b  ")).toBe("PRD-MATCHA-1A2B");
  });

  it("builds readable, bounded automatic SKUs", () => {
    expect(formatAutomaticSku("PRD", "Classic Milk Tea", "7f3a")).toBe(
      "PRD-CLASSIC-MILK-TEA-7F3A",
    );
    expect(formatAutomaticSku("INV", "Tapioca pearls", "91c2")).toBe(
      "INV-TAPIOCA-PEARLS-91C2",
    );
    expect(formatAutomaticSku("PRD", "x".repeat(200), "A1B2")).toHaveLength(80);
  });

  it("rejects unusable suffixes", () => {
    expect(() => formatAutomaticSku("PRD", "Matcha", "?!")).toThrow(/suffix/i);
  });

  it("retries automatic SKUs when a candidate already exists", async () => {
    const suffixes = ["AAAA", "B2C3"];
    const checkedSkus: string[] = [];

    await expect(
      selectAvailableAutomaticSku({
        prefix: "PRD",
        name: "Matcha Latte",
        nextSuffix: () => suffixes.shift() ?? "ZZZZ",
        isAvailable: (sku) => {
          checkedSkus.push(sku);
          return sku.endsWith("B2C3");
        },
      }),
    ).resolves.toBe("PRD-MATCHA-LATTE-B2C3");
    expect(checkedSkus).toEqual([
      "PRD-MATCHA-LATTE-AAAA",
      "PRD-MATCHA-LATTE-B2C3",
    ]);
  });
});
