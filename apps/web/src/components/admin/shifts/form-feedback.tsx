"use client";
import { useEffect, useRef } from "react";
import type { ActionFeedback } from "@/app/admin/_components/form-utils";
import { AlertCircle } from "lucide-react";

export function ShiftFormFeedback({
  feedback,
  onField,
}: {
  feedback: ActionFeedback;
  onField?: (field: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (feedback.error) ref.current?.focus();
  }, [feedback]);
  if (!feedback.error) return null;
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      className="rounded-lg border border-destructive/30 bg-destructive-surface p-4 text-sm text-destructive outline-none focus-visible:ring-2 focus-visible:ring-destructive"
    >
      <p className="flex items-center gap-2 font-semibold">
        <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
        {feedback.error}
      </p>
      {Object.keys(feedback.fieldErrors ?? {}).length > 0 && (
        <ul className="mt-2 list-inside list-disc space-y-1">
          {Object.entries(feedback.fieldErrors ?? {}).map(([field, errors]) => (
            <li key={field}>
              <button
                type="button"
                className="text-left underline underline-offset-2"
                onClick={() =>
                  onField
                    ? onField(field)
                    : document.getElementById(`field-${field}`)?.focus()
                }
              >
                {errors[0]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
export function FieldError({
  field,
  errors,
}: {
  field: string;
  errors?: Record<string, string[]>;
}) {
  return errors?.[field]?.[0] ? (
    <p id={`error-${field}`} className="text-sm text-destructive">
      {errors[field][0]}
    </p>
  ) : null;
}
export function errorProps(field: string, errors?: Record<string, string[]>) {
  return {
    id: `field-${field}`,
    "aria-invalid": Boolean(errors?.[field]),
    "aria-describedby": errors?.[field] ? `error-${field}` : undefined,
  };
}
