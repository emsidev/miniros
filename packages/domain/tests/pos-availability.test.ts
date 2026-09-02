import { describe, expect, it } from "vitest";
import { calculatePosAvailableQuantity } from "../src/pos-availability";

const balances = [
  { inventoryItemId: "bread", quantity: "12.000" },
  { inventoryItemId: "filling", quantity: "2.250" },
];

const products = [
  {
    productId: "boxed-bread",
    requirements: [{ inventoryItemId: "bread", quantityPerUnit: 6 }],
  },
  {
    productId: "filled-bread",
    requirements: [
      { inventoryItemId: "bread", quantityPerUnit: 1 },
      { inventoryItemId: "filling", quantityPerUnit: "0.250" },
    ],
  },
  { productId: "service-fee", requirements: [] },
];

describe("calculatePosAvailableQuantity", () => {
  it("returns direct finished-good availability in whole sellable units", () => {
    expect(
      calculatePosAvailableQuantity({
        productId: "boxed-bread",
        products,
        balances,
        cart: [],
      }),
    ).toBe(2);
  });

  it("uses the limiting ingredient for a recipe product", () => {
    expect(
      calculatePosAvailableQuantity({
        productId: "filled-bread",
        products,
        balances,
        cart: [],
      }),
    ).toBe(9);
  });

  it("returns null for products that are not stock-limited", () => {
    expect(
      calculatePosAvailableQuantity({
        productId: "service-fee",
        products,
        balances,
        cart: [],
      }),
    ).toBeNull();
  });

  it("treats missing or zero balances as sold out", () => {
    expect(
      calculatePosAvailableQuantity({
        productId: "filled-bread",
        products,
        balances: [{ inventoryItemId: "bread", quantity: 12 }],
        cart: [],
      }),
    ).toBe(0);

    expect(
      calculatePosAvailableQuantity({
        productId: "broken-recipe",
        products: [
          { productId: "broken-recipe", stockTracked: true, requirements: [] },
        ],
        balances,
        cart: [],
      }),
    ).toBe(0);
  });

  it("accounts for other cart products that share inventory", () => {
    expect(
      calculatePosAvailableQuantity({
        productId: "filled-bread",
        products,
        balances,
        cart: [{ productId: "boxed-bread", quantity: 1 }],
      }),
    ).toBe(6);
  });

  it("aggregates duplicate requirements and rejects invalid stock", () => {
    expect(
      calculatePosAvailableQuantity({
        productId: "bundle",
        products: [
          {
            productId: "bundle",
            requirements: [
              { inventoryItemId: "bread", quantityPerUnit: 1 },
              { inventoryItemId: "bread", quantityPerUnit: 2 },
            ],
          },
        ],
        balances: [{ inventoryItemId: "bread", quantity: 8 }],
        cart: [],
      }),
    ).toBe(2);

    expect(() =>
      calculatePosAvailableQuantity({
        productId: "bundle",
        products: [
          {
            productId: "bundle",
            requirements: [{ inventoryItemId: "bread", quantityPerUnit: 1 }],
          },
        ],
        balances: [{ inventoryItemId: "bread", quantity: -1 }],
        cart: [],
      }),
    ).toThrow(/must not be negative/);
  });
});
