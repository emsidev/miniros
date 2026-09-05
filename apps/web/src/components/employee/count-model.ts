import {
  evaluateNumericExpression,
  normalizeNumericExpression,
} from "../../lib/numeric-expression";

export type CountItem = {
  id: string;
  name: string;
  unit: string;
  initialQuantity: string;
};
export type FieldError = { id: string; label: string; message: string };
export type CountValues = Record<string, string>;
export function initialCounts(items: readonly CountItem[]): CountValues {
  return Object.fromEntries(
    items.map((item) => [item.id, item.initialQuantity]),
  );
}
export function validateCounts(
  items: readonly CountItem[],
  values: CountValues,
): FieldError[] {
  return items.flatMap((item) => {
    const result = evaluateNumericExpression(values[item.id]);
    const message = !result.ok
      ? result.error
      : result.value < 0
        ? "Enter zero or a positive quantity."
        : undefined;
    return message
      ? [{ id: `count-${item.id}`, label: item.name, message }]
      : [];
  });
}
export function countsPayload(
  items: readonly CountItem[],
  values: CountValues,
) {
  return items.map((item) => ({
    inventoryItemId: item.id,
    quantity: normalizeNumericExpression(values[item.id], 3),
  }));
}
export function validateCash(value: string): FieldError[] {
  const result = evaluateNumericExpression(value);
  const message = !result.ok
    ? result.error
    : result.value < 0
      ? "Enter zero or a positive cash amount."
      : undefined;
  return message
    ? [{ id: "actualCash", label: "Actual cash counted", message }]
    : [];
}
