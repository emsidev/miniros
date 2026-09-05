"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FieldError } from "./count-model";

export function WorkflowSteps({
  steps,
  current,
}: {
  steps: readonly string[];
  current: number;
}) {
  return (
    <ol
      aria-label="Progress"
      className="grid gap-2 border-b pb-5"
      style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0,1fr))` }}
    >
      {steps.map((step, index) => (
        <li
          key={step}
          aria-current={index === current ? "step" : undefined}
          className="flex min-w-0 flex-col gap-2 text-xs sm:flex-row sm:items-center sm:text-sm"
        >
          <span
            className={cn(
              "grid size-7 shrink-0 place-items-center rounded-full font-bold",
              index === current
                ? "bg-foreground text-background"
                : index < current
                  ? "bg-accent text-accent-foreground"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {index < current ? (
              <Check className="size-4" aria-hidden="true" />
            ) : (
              index + 1
            )}
          </span>
          <span
            className={
              index === current ? "font-bold" : "text-muted-foreground"
            }
          >
            {index < current ? (
              <span className="sr-only">Completed: </span>
            ) : null}
            {step}
          </span>
        </li>
      ))}
    </ol>
  );
}
export function WorkflowErrors({
  errors,
  message,
  attempt,
  onField,
}: {
  errors: readonly FieldError[];
  message?: string;
  attempt: number;
  onField: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (attempt) ref.current?.focus();
  }, [attempt]);
  if (!errors.length && !message) return null;
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      className="rounded-lg border border-destructive bg-destructive-surface p-4 text-sm text-destructive"
    >
      <h2 className="font-bold">
        {errors.length ? "Check these details" : "We couldn’t save this yet"}
      </h2>
      {message ? <p className="mt-1">{message}</p> : null}
      {errors.length ? (
        <ul className="mt-2 space-y-1">
          {errors.map((error) => (
            <li key={error.id}>
              <a
                href={`#${error.id}`}
                className="inline-flex min-h-9 items-center underline"
                onClick={(event) => {
                  event.preventDefault();
                  onField(error.id);
                }}
              >
                {error.label}: {error.message}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
export function WorkflowActions({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-10 flex flex-wrap items-center justify-end gap-3 rounded-xl border bg-card p-3 md:bottom-4">
      {children}
    </div>
  );
}
