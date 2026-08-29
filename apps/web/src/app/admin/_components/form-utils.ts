export type ActionFeedback = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

export function firstFieldError(feedback: ActionFeedback, field: string) {
  return feedback.fieldErrors?.[field]?.[0];
}

export function optionalText(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

export function moneyToCents(value: FormDataEntryValue | null) {
  const amount = Number(String(value ?? ""));
  return Number.isFinite(amount) ? Math.round(amount * 100) : Number.NaN;
}

export function humanize(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
