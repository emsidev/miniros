import { evaluateNumericExpression } from "./numeric-expression";

export type InventoryFormError = { id: string; label: string; message: string };
export function inventoryFieldErrors(
  fields: Record<string, string[]> | undefined,
  targets: Record<string, { id: string; label: string }>,
): InventoryFormError[] {
  return Object.entries(fields ?? {}).flatMap(([field, messages]) =>
    targets[field] && messages.length
      ? [{ ...targets[field], message: messages.join(" ") }]
      : [],
  );
}
export type CashDraft = {
  uncertain?: boolean;
  id: string;
  label: string;
  amount: string;
  reason: string;
};
export type AdjustmentDraft = {
  uncertain?: boolean;
  id: string;
  eventId: string;
  inventoryItemId: string;
  direction: "add" | "remove";
  quantity: string;
  reason: string;
};
export type MovementLine = {
  id: string;
  inventoryItemId: string;
  quantity: string;
};
export type MovementDraft = {
  uncertain?: boolean;
  id: string;
  eventId: string;
  secondEventId: string;
  locationId: string;
  fromLocationId: string;
  toLocationId: string;
  referenceNumber: string;
  notes: string;
  lines: MovementLine[];
};
export const newCashDraft = (): CashDraft => ({
  id: crypto.randomUUID(),
  label: "",
  amount: "",
  reason: "",
});
export const newAdjustmentDraft = (): AdjustmentDraft => ({
  id: crypto.randomUUID(),
  eventId: crypto.randomUUID(),
  inventoryItemId: "",
  direction: "remove",
  quantity: "",
  reason: "",
});
export const newMovementLine = (): MovementLine => ({
  id: crypto.randomUUID(),
  inventoryItemId: "",
  quantity: "",
});
export const newMovementDraft = (): MovementDraft => ({
  id: crypto.randomUUID(),
  eventId: crypto.randomUUID(),
  secondEventId: crypto.randomUUID(),
  locationId: "",
  fromLocationId: "",
  toLocationId: "",
  referenceNumber: "",
  notes: "",
  lines: [newMovementLine()],
});

export function positiveAmount(value: string, precision: number) {
  const result = evaluateNumericExpression(value);
  if (!result.ok) return null;
  const rounded = Math.round(result.value * 10 ** precision) / 10 ** precision;
  return result.value > 0 && rounded > 0 && rounded < 100000000000
    ? rounded
    : null;
}
export function adjustmentDelta(direction: "add" | "remove", quantity: string) {
  const amount = positiveAmount(quantity, 3);
  return amount === null ? null : direction === "remove" ? -amount : amount;
}
export function validateCashDraft(draft: CashDraft): InventoryFormError[] {
  const errors: InventoryFormError[] = [];
  if (!draft.label.trim())
    errors.push({
      id: "cash-purpose",
      label: "Purpose",
      message: "Enter what the cash was used for.",
    });
  if (positiveAmount(draft.amount, 2) === null)
    errors.push({
      id: "cash-amount",
      label: "Amount",
      message: "Enter a positive amount of at least ₱0.01.",
    });
  return errors;
}
export function validateAdjustmentDraft(
  draft: AdjustmentDraft,
  items: readonly { inventoryItemId: string; quantityOnHand: string }[],
  approvalsEnabled: boolean,
): InventoryFormError[] {
  const errors: InventoryFormError[] = [];
  const item = items.find(
    (item) => item.inventoryItemId === draft.inventoryItemId,
  );
  const delta = adjustmentDelta(draft.direction, draft.quantity);
  if (!item)
    errors.push({
      id: "adjustment-item",
      label: "Inventory item",
      message: "Choose an available inventory item.",
    });
  if (delta === null)
    errors.push({
      id: "adjustment-quantity",
      label: "Quantity",
      message: "Enter a positive quantity of at least 0.001.",
    });
  else if (item && !approvalsEnabled && Number(item.quantityOnHand) + delta < 0)
    errors.push({
      id: "adjustment-quantity",
      label: "Quantity",
      message: "This would remove more stock than is available.",
    });
  if (!draft.reason.trim())
    errors.push({
      id: "adjustment-reason",
      label: "Reason",
      message: "Explain why the stock changed.",
    });
  return errors;
}
export function validateMovementDraft(
  draft: MovementDraft,
  mode: "receive" | "transfer",
  locations: readonly { id: string }[],
  items: readonly { id: string }[],
): InventoryFormError[] {
  const errors: InventoryFormError[] = [];
  const locationExists = (id: string) =>
    locations.some((location) => location.id === id);
  if (mode === "receive" && !locationExists(draft.locationId))
    errors.push({
      id: "receiving-location",
      label: "Receive into",
      message: "Choose an available location.",
    });
  if (mode === "transfer") {
    if (!locationExists(draft.fromLocationId))
      errors.push({
        id: "transfer-from",
        label: "From",
        message: "Choose an available source location.",
      });
    if (!locationExists(draft.toLocationId))
      errors.push({
        id: "transfer-to",
        label: "To",
        message: "Choose an available destination.",
      });
    else if (draft.toLocationId === draft.fromLocationId)
      errors.push({
        id: "transfer-to",
        label: "To",
        message: "Choose a different destination.",
      });
  }
  if (!draft.lines.length || draft.lines.length > 100)
    errors.push({
      id: "movement-lines",
      label: "Items",
      message: "Include between 1 and 100 items.",
    });
  const selected = new Set<string>();
  draft.lines.forEach((line, index) => {
    if (!items.some((item) => item.id === line.inventoryItemId))
      errors.push({
        id: `item-${line.id}`,
        label: `Item ${index + 1}`,
        message: "Choose an available item.",
      });
    else if (selected.has(line.inventoryItemId))
      errors.push({
        id: `item-${line.id}`,
        label: `Item ${index + 1}`,
        message: "This item already has a row. Update its quantity instead.",
      });
    selected.add(line.inventoryItemId);
    if (positiveAmount(line.quantity, 3) === null)
      errors.push({
        id: `quantity-${line.id}`,
        label: `Quantity ${index + 1}`,
        message: "Enter a positive quantity of at least 0.001.",
      });
  });
  return errors;
}
