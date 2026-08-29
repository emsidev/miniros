"use client";

import type { ComponentProps } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function SearchInput({
  className,
  ...props
}: ComponentProps<typeof Input>) {
  return (
    <div className={cn("relative w-full sm:max-w-sm", className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input type="search" className="h-11 rounded-xl pl-9" {...props} />
    </div>
  );
}

type LabeledInputProps = Omit<ComponentProps<typeof Input>, "type"> & {
  label: string;
  error?: string;
};

export function MoneyInput({ label, error, id, ...props }: LabeledInputProps) {
  const inputId = id ?? props.name;
  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>{label}</Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-muted-foreground">
          ₱
        </span>
        <Input
          id={inputId}
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          className="h-12 rounded-xl pl-8"
          aria-invalid={Boolean(error)}
          {...props}
        />
      </div>
      {error ? (
        <p className="text-xs font-medium text-destructive">{error}</p>
      ) : null}
    </div>
  );
}

export function QuantityInput({
  label,
  error,
  id,
  ...props
}: LabeledInputProps) {
  const inputId = id ?? props.name;
  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>{label}</Label>
      <Input
        id={inputId}
        type="number"
        inputMode="decimal"
        step="0.001"
        className="h-12 rounded-xl"
        aria-invalid={Boolean(error)}
        {...props}
      />
      {error ? (
        <p className="text-xs font-medium text-destructive">{error}</p>
      ) : null}
    </div>
  );
}

export function DateRangeFilter({
  fromName = "from",
  toName = "to",
  defaultFrom,
  defaultTo,
}: {
  fromName?: string;
  toName?: string;
  defaultFrom?: string;
  defaultTo?: string;
}) {
  return (
    <fieldset className="grid grid-cols-2 gap-2">
      <legend className="sr-only">Date range</legend>
      <div>
        <Label htmlFor={fromName} className="sr-only">
          From date
        </Label>
        <Input
          id={fromName}
          name={fromName}
          type="date"
          defaultValue={defaultFrom}
          className="h-11 rounded-xl"
        />
      </div>
      <div>
        <Label htmlFor={toName} className="sr-only">
          To date
        </Label>
        <Input
          id={toName}
          name={toName}
          type="date"
          defaultValue={defaultTo}
          className="h-11 rounded-xl"
        />
      </div>
    </fieldset>
  );
}
