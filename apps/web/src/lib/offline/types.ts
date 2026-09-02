import type { PaymentMethod } from "@miniros/contracts/constants";

export const offlineActionTypes = [
  "START_SHIFT",
  "CREATE_SALE",
  "UPLOAD_PAYMENT_PROOF",
  "CREATE_PRODUCTION_LOG",
  "CREATE_CASH_DEDUCTION",
  "CREATE_INVENTORY_ADJUSTMENT",
  "SUBMIT_CLOSEOUT",
  "RECEIVE_STOCK",
  "TRANSFER_STOCK",
] as const;

export type OfflineActionType = (typeof offlineActionTypes)[number];
export type OfflineActionStatus =
  "pending" | "processing" | "synced" | "failed";

type QuantityLine = Readonly<{ inventoryItemId: string; quantity: string }>;

export type OfflineActionPayloadMap = {
  START_SHIFT: Readonly<{ shiftId: string; openingCounts: QuantityLine[] }>;
  CREATE_SALE: Readonly<{
    shiftId: string;
    saleId: string;
    items: ReadonlyArray<{ productId: string; quantity: string }>;
    payments: ReadonlyArray<{
      paymentId: string;
      method: PaymentMethod;
      amountCents: number;
      referenceNumber?: string;
    }>;
  }>;
  UPLOAD_PAYMENT_PROOF: Readonly<{
    paymentId: string;
    fileName: string;
    mimeType: string;
    localBlobId: string;
  }>;
  CREATE_PRODUCTION_LOG: Readonly<{
    productionLogId: string;
    productionInputEventId: string;
    productionOutputEventId: string;
    inventoryLocationId: string;
    productId: string;
    quantity: string;
  }>;
  CREATE_CASH_DEDUCTION: Readonly<{
    shiftId: string;
    cashDeductionId: string;
    amountCents: number;
    reason: string;
  }>;
  CREATE_INVENTORY_ADJUSTMENT: Readonly<{
    shiftId: string;
    inventoryAdjustmentId: string;
    inventoryEventId: string;
    inventoryItemId: string;
    quantityDelta: string;
    reason: string;
  }>;
  SUBMIT_CLOSEOUT: Readonly<{
    shiftId: string;
    closeoutId: string;
    actualCashCents: number;
    closingCounts: QuantityLine[];
    notes?: string;
  }>;
  RECEIVE_STOCK: Readonly<{
    inventoryEventId: string;
    inventoryLocationId: string;
    lines: QuantityLine[];
  }>;
  TRANSFER_STOCK: Readonly<{
    stockTransferId: string;
    fromInventoryLocationId: string;
    toInventoryLocationId: string;
    lines: QuantityLine[];
  }>;
};

export type OfflineQueueItem<T extends OfflineActionType = OfflineActionType> =
  {
    id: string;
    businessId: string;
    type: T;
    payload: OfflineActionPayloadMap[T];
    status: OfflineActionStatus;
    attemptCount: number;
    createdAt: string;
    updatedAt: string;
    lastError?: string;
  };

export type NewOfflineAction<T extends OfflineActionType> = Readonly<{
  id?: string;
  businessId: string;
  type: T;
  payload: OfflineActionPayloadMap[T];
}>;
