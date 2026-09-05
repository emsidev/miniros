import { randomUUID } from "node:crypto";
import { offlineOperationSchema, type PreparedShift } from "@miniros/contracts";
export const uuid = randomUUID;
export function preparedFixture(): PreparedShift {
  const productId = uuid(),
    inventoryItemId = uuid();
  return {
    id: uuid(),
    deviceId: "test-device",
    status: "prepared",
    acknowledgedSequence: 0,
    lastError: null,
    snapshot: {
      schemaVersion: 1,
      storageInstallationId: uuid(),
      id: uuid(),
      preparedAt: new Date().toISOString(),
      businessId: uuid(),
      businessName: "Disposable pilot",
      userId: uuid(),
      employeeId: uuid(),
      shiftId: uuid(),
      locationName: "Test booth",
      shiftDate: "2026-09-05",
      inventoryLocationId: uuid(),
      features: {
        recipesEnabled: true,
        promosEnabled: true,
        approvalsEnabled: false,
      },
      products: [
        {
          id: productId,
          name: "Tea",
          categoryName: "Drinks",
          priceCents: 10000,
          costCents: 3000,
          requiresRecipeDeduction: true,
          producedInventoryItemId: null,
        },
      ],
      inventory: [
        {
          id: inventoryItemId,
          name: "Cup",
          unit: "pcs",
          defaultUnitCostCents: 500,
        },
      ],
      recipes: [
        { productId, inventoryItemId, quantityPerProduct: "1", unit: "pcs" },
      ],
      promos: [],
      costs: {
        rentCents: 1000,
        transportCents: 200,
        otherCents: 0,
        salaryCents: 800,
      },
    },
  };
}
export function opening(session: PreparedShift) {
  return offlineOperationSchema.parse({
    type: "START_SHIFT",
    payload: {
      shiftId: session.snapshot.shiftId,
      inventoryLocationId: session.snapshot.inventoryLocationId,
      openingEventId: uuid(),
      counts: [
        { inventoryItemId: session.snapshot.inventory[0]!.id, quantity: 10 },
      ],
    },
  });
}
export function sale(session: PreparedShift, quantity = 2) {
  return offlineOperationSchema.parse({
    type: "CREATE_SALE",
    payload: {
      shiftId: session.snapshot.shiftId,
      saleId: uuid(),
      inventoryEventId: uuid(),
      items: [
        {
          id: uuid(),
          productId: session.snapshot.products[0]!.id,
          quantity,
          discountCents: 0,
        },
      ],
      payments: [
        {
          id: uuid(),
          paymentMethod: "cash",
          amountCents: quantity * 10000 + 5000,
        },
      ],
    },
    proofs: [],
  });
}
export function closeout(session: PreparedShift, cash = 20000, count = 8) {
  return offlineOperationSchema.parse({
    type: "SUBMIT_CLOSEOUT",
    payload: {
      shiftId: session.snapshot.shiftId,
      closeoutId: uuid(),
      inventoryEventId: uuid(),
      cashReconciliationId: uuid(),
      profitSummaryId: uuid(),
      actualCashCents: cash,
      counts: [
        { inventoryItemId: session.snapshot.inventory[0]!.id, quantity: count },
      ],
    },
  });
}
