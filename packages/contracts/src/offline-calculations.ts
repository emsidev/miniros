import {
  addCents,
  aggregateInventoryDeductions,
  multiplyCentsByQuantity,
  normalizeQuantity,
  percentageOfCents,
} from "@miniros/domain";
import type { OfflineOperation, PreparedSnapshot } from "./offline";

export type LocalShiftProjection = {
  state: "prepared" | "active" | "closing";
  balances: Record<string, string>;
  saleCount: number;
  itemCount: number;
  salesCents: number;
  productCostCents: number;
  cashCents: number;
  deductionsCents: number;
};
export const emptyShiftProjection = (): LocalShiftProjection => ({
  state: "prepared",
  balances: {},
  saleCount: 0,
  itemCount: 0,
  salesCents: 0,
  productCostCents: 0,
  cashCents: 0,
  deductionsCents: 0,
});

export function calculatePreparedSale(
  snapshot: PreparedSnapshot,
  operation: Extract<OfflineOperation, { type: "CREATE_SALE" }>,
) {
  const items = operation.payload.items.map((line) => {
    const product = snapshot.products.find((p) => p.id === line.productId);
    if (!product)
      throw new Error("This product was not prepared for the shift.");
    const total =
      multiplyCentsByQuantity(product.priceCents, line.quantity) -
      line.discountCents;
    if (total < 0) throw new Error("A discount exceeds its line total.");
    return {
      ...line,
      name: product.name,
      priceCents: product.priceCents,
      costCents: product.costCents,
      totalCents: total,
    };
  });
  const discount = operation.payload.discount;
  if (discount) {
    const promo = snapshot.promos.find((p) => p.id === discount.promoId);
    if (!promo?.requiresPhoto)
      throw new Error(
        "The selected photo-required promo was not prepared for this shift.",
      );
    const subtotal = addCents(
      ...items.map((i) => multiplyCentsByQuantity(i.priceCents, i.quantity)),
    );
    const expected = Math.min(
      subtotal,
      promo.discountType === "fixed_amount"
        ? Math.round(promo.discountValue * 100)
        : percentageOfCents(subtotal, promo.discountValue),
    );
    if (addCents(...items.map((i) => i.discountCents)) !== expected)
      throw new Error("The promo amount does not match this prepared shift.");
  }
  const totalCents = addCents(...items.map((line) => line.totalCents));
  const amountPaidCents = addCents(
    ...operation.payload.payments.map((p) => p.amountCents),
  );
  const cashTender = addCents(
    ...operation.payload.payments
      .filter((p) => p.paymentMethod === "cash")
      .map((p) => p.amountCents),
  );
  const changeCents = amountPaidCents - totalCents;
  if (totalCents <= 0 || changeCents < 0 || changeCents > cashTender)
    throw new Error(
      "Payment does not cover the total, or change exceeds cash tender.",
    );
  if (
    new Set(items.map((i) => i.id)).size !== items.length ||
    new Set(operation.payload.payments.map((p) => p.id)).size !==
      operation.payload.payments.length
  )
    throw new Error("Sale and payment IDs must be unique.");
  const deductions = aggregateInventoryDeductions(
    items.map((line) => {
      const product = snapshot.products.find((p) => p.id === line.productId)!;
      return {
        productId: product.id,
        quantitySold: line.quantity,
        requiresRecipeDeduction:
          snapshot.features.recipesEnabled &&
          product.requiresRecipeDeduction &&
          !product.producedInventoryItemId,
      };
    }),
    snapshot.recipes,
  );
  const deltas: Record<string, number> = {};
  for (const d of deductions)
    deltas[d.inventoryItemId] = normalizeQuantity(
      (deltas[d.inventoryItemId] ?? 0) + normalizeQuantity(d.quantityDelta),
    );
  for (const line of items) {
    const id = snapshot.products.find(
      (p) => p.id === line.productId,
    )!.producedInventoryItemId;
    if (id)
      deltas[id] = normalizeQuantity(
        (deltas[id] ?? 0) - normalizeQuantity(line.quantity),
      );
  }
  return {
    saleId: operation.payload.saleId,
    totalCents,
    amountPaidCents,
    changeCents,
    cashCents: cashTender - changeCents,
    productCostCents: addCents(
      ...items.map((i) => multiplyCentsByQuantity(i.costCents, i.quantity)),
    ),
    items,
    payments: operation.payload.payments,
    deltas,
  };
}

export function projectOfflineOperation(
  snapshot: PreparedSnapshot,
  previous: LocalShiftProjection,
  operation: OfflineOperation,
): LocalShiftProjection {
  const next = { ...previous, balances: { ...previous.balances } };
  if (operation.payload.shiftId !== snapshot.shiftId)
    throw new Error("The operation belongs to another shift.");
  if (operation.type === "START_SHIFT") {
    if (previous.state !== "prepared")
      throw new Error("This shift has already started.");
    if (operation.payload.inventoryLocationId !== snapshot.inventoryLocationId)
      throw new Error("Opening inventory does not match the prepared shift.");
    next.state = "active";
  } else if (previous.state !== "active")
    throw new Error(
      "Open this shift before recording work. A submitted closeout cannot accept more sales.",
    );
  if (
    operation.type === "START_SHIFT" ||
    operation.type === "SUBMIT_CLOSEOUT"
  ) {
    const counts = operation.payload.counts;
    if (
      counts.length !== snapshot.inventory.length ||
      new Set(counts.map((c) => c.inventoryItemId)).size !== counts.length ||
      counts.some(
        (c) => !snapshot.inventory.some((i) => i.id === c.inventoryItemId),
      )
    )
      throw new Error("Count every prepared inventory item exactly once.");
    if (operation.type === "START_SHIFT")
      for (const count of counts)
        next.balances[count.inventoryItemId] = String(count.quantity);
    else next.state = "closing";
  }
  if (operation.type === "CREATE_SALE") {
    const sale = calculatePreparedSale(snapshot, operation);
    for (const [id, delta] of Object.entries(sale.deltas)) {
      const quantity = normalizeQuantity(
        normalizeQuantity(next.balances[id] ?? 0) + delta,
      );
      if (quantity < 0)
        throw new Error(
          `Insufficient stock: ${snapshot.inventory.find((i) => i.id === id)?.name ?? id}.`,
        );
      next.balances[id] = String(quantity);
    }
    next.saleCount++;
    next.itemCount += sale.items.reduce(
      (sum, item) => sum + normalizeQuantity(item.quantity),
      0,
    );
    next.salesCents = addCents(next.salesCents, sale.totalCents);
    next.cashCents = addCents(next.cashCents, sale.cashCents);
    next.productCostCents = addCents(
      next.productCostCents,
      sale.productCostCents,
    );
  }
  if (operation.type === "CREATE_CASH_DEDUCTION")
    next.deductionsCents = addCents(
      next.deductionsCents,
      operation.payload.amountCents,
    );
  if (
    operation.type === "CREATE_INVENTORY_ADJUSTMENT" &&
    !snapshot.inventory.some((i) => i.id === operation.payload.inventoryItemId)
  )
    throw new Error("This inventory item was not prepared.");
  if (operation.type === "CREATE_INVENTORY_ADJUSTMENT") {
    const delta = normalizeQuantity(operation.payload.quantityDelta);
    if (delta < 0) {
      const id = operation.payload.inventoryItemId;
      const balance = normalizeQuantity(
        normalizeQuantity(next.balances[id] ?? 0) + delta,
      );
      if (balance < 0)
        throw new Error("Stock removed exceeds the available quantity.");
      next.balances[id] = String(balance);
    }
  }
  // Positive requests never manufacture available stock; reviews are online.
  return next;
}
