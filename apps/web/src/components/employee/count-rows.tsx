"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumericExpressionInput } from "@/components/ui/numeric-expression-input";
import { normalizeNumericExpression } from "@/lib/numeric-expression";
import { formatQuantity } from "@/lib/format";
import type { CountItem, CountValues, FieldError } from "./count-model";

export function CountRows({
  items,
  values,
  onChange,
  query,
  onQuery,
  errors,
  closing,
  disabled,
}: {
  items: readonly CountItem[];
  values: CountValues;
  onChange: (id: string, value: string) => void;
  query: string;
  onQuery: (value: string) => void;
  errors: readonly FieldError[];
  closing: boolean;
  disabled: boolean;
}) {
  const filtered = items.filter((item) =>
    `${item.name} ${item.unit}`
      .toLowerCase()
      .includes(query.toLowerCase().trim()),
  );
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="count-search">Find an inventory item</Label>
        <div className="relative">
          <Search
            className="absolute left-3 top-3 size-5 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="count-search"
            type="search"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Search stock…"
            className="pl-10"
          />
        </div>
      </div>
      <p className="text-sm text-muted-foreground" role="status">
        {filtered.length} of {items.length} items ·{" "}
        {closing
          ? "Prefilled estimates — verify each count."
          : "Starts at zero — enter the stock you have."}
      </p>
      <div className="divide-y rounded-xl border bg-card">
        {!filtered.length ? (
          <p className="p-5 text-sm text-muted-foreground">
            {items.length
              ? "No items match. Clear the search to see all stock."
              : "No inventory items are available to count."}
          </p>
        ) : (
          filtered.map((item) => {
            const id = `count-${item.id}`;
            const error = errors.find((error) => error.id === id);
            return (
              <div
                key={item.id}
                className="grid grid-cols-[minmax(0,1fr)_7.5rem] items-start gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_10rem]"
              >
                <div className="min-w-0">
                  <Label htmlFor={id} className="break-words font-semibold">
                    {item.name}
                  </Label>
                  <p
                    id={`${id}-hint`}
                    className="mt-1 text-sm text-muted-foreground"
                  >
                    {closing
                      ? `Estimated ${formatQuantity(item.initialQuantity)} ${item.unit}`
                      : item.unit}
                  </p>
                </div>
                <div className="min-w-0">
                  <NumericExpressionInput
                    id={id}
                    name={id}
                    value={values[item.id]}
                    onValueChange={(value) => onChange(item.id, value)}
                    precision={3}
                    min="0"
                    step="0.001"
                    required
                    disabled={disabled}
                    aria-invalid={!!error}
                    aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
                    className="text-right tabular-nums"
                  />
                  {error ? (
                    <p
                      id={`${id}-error`}
                      className="mt-1 text-xs text-destructive"
                    >
                      {error.message}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
export function CountReview({
  items,
  values,
}: {
  items: readonly CountItem[];
  values: CountValues;
}) {
  return (
    <dl className="divide-y rounded-xl border bg-card">
      {items.map((item) => (
        <div
          key={item.id}
          className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 px-4 py-3 text-sm"
        >
          <dt className="break-words">{item.name}</dt>
          <dd className="break-words text-right font-semibold tabular-nums">
            {formatQuantity(normalizeNumericExpression(values[item.id], 3))}{" "}
            <span className="font-normal text-muted-foreground">
              {item.unit}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
