"use client";

import { Button } from "@/components/ui/button";
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
  category = "all",
  onCategory,
  uncounted = false,
  onUncounted,
}: {
  items: readonly CountItem[];
  values: CountValues;
  onChange: (id: string, value: string) => void;
  query: string;
  onQuery: (value: string) => void;
  errors: readonly FieldError[];
  closing: boolean;
  disabled: boolean;
  category?: string;
  onCategory?: (value: string) => void;
  uncounted?: boolean;
  onUncounted?: (value: boolean) => void;
}) {
  const categories = [
    ...new Set(items.map((item) => item.categoryName ?? item.unit)),
  ];
  const counted = items.filter((item) => values[item.id]?.trim()).length;
  const filtered = items.filter(
    (item) =>
      `${item.name} ${item.unit}`
        .toLowerCase()
        .includes(query.toLowerCase().trim()) &&
      (category === "all" || (item.categoryName ?? item.unit) === category) &&
      (!uncounted || !values[item.id]?.trim()),
  );
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="count-search" className="sr-only sm:not-sr-only">
          Find an inventory item
        </Label>
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
      <div className="flex flex-wrap items-end gap-3">
        {onCategory ? (
          <div className="min-w-32 flex-1 space-y-1">
            <Label htmlFor="count-category" className="sr-only sm:not-sr-only">
              Stock group
            </Label>
            <select
              id="count-category"
              value={category}
              onChange={(event) => onCategory(event.target.value)}
              className="h-12 w-full rounded-lg border bg-card px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="all">All stock</option>
              {categories.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </div>
        ) : null}
        {onUncounted ? (
          <Button
            type="button"
            variant={uncounted ? "default" : "outline"}
            aria-pressed={uncounted}
            onClick={() => onUncounted(!uncounted)}
          >
            Uncounted
          </Button>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground" role="status">
        {counted} of {items.length} counted · {filtered.length} shown
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
                    value={values[item.id] ?? ""}
                    placeholder="Count"
                    onValueChange={(value) => onChange(item.id, value)}
                    precision={3}
                    min="0"
                    step="0.001"
                    required
                    disabled={disabled}
                    aria-invalid={!!error}
                    aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
                    className="h-12 text-right text-lg font-semibold tabular-nums"
                  />
                  {!closing ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="min-h-12 w-full text-sm"
                      disabled={disabled}
                      onClick={() => onChange(item.id, "0")}
                    >
                      Not brought · 0
                    </Button>
                  ) : null}
                  {error ? (
                    <p
                      id={`${id}-error`}
                      role="alert"
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
  closing = false,
}: {
  items: readonly CountItem[];
  values: CountValues;
  closing?: boolean;
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
            {closing ? (
              <span className="mt-1 block text-sm font-normal text-muted-foreground">
                Expected {formatQuantity(item.initialQuantity)} · difference{" "}
                {formatQuantity(
                  String(
                    Number(normalizeNumericExpression(values[item.id], 3)) -
                      Number(item.initialQuantity),
                  ),
                )}
              </span>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
