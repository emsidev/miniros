"use client";
import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatQuantity } from "@/lib/format";
export function StockList({
  balances,
  historical = false,
  onAdjust,
}: {
  historical?: boolean;
  onAdjust?: (id: string) => void;
  balances: readonly {
    inventoryItemId: string;
    name: string;
    unit: string;
    openingQuantity: string | null;
    quantityOnHand: string | null;
    adjustable?: boolean;
  }[];
}) {
  const [query, setQuery] = useState("");
  const filtered = balances.filter((item) =>
    `${item.name} ${item.unit}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  return (
    <section className="space-y-4" aria-labelledby="stock-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="stock-heading" className="text-lg font-bold">
            {historical ? "Closing stock" : "Current stock"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {historical
              ? "Physical counts saved at closeout."
              : "Estimates based on recorded stock movements."}
          </p>
        </div>
        <p role="status" className="text-sm text-muted-foreground">
          {filtered.length} of {balances.length} items
        </p>
      </div>
      <div className="max-w-md space-y-2">
        <Label htmlFor="stock-search">Find an inventory item</Label>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="absolute left-3 top-3 size-5 text-muted-foreground"
          />
          <Input
            id="stock-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-10"
            placeholder="Search stock…"
          />
        </div>
      </div>
      <div className="rounded-xl border bg-card">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 border-b px-4 py-3 text-sm text-muted-foreground">
          <span>Inventory item</span>
          <span className="text-right">
            {historical ? "Counted at close" : "Estimated on hand"}
          </span>
        </div>
        <dl className="divide-y">
          {filtered.map((item) => (
            <div
              key={item.inventoryItemId}
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-4 p-4"
            >
              <dt className="min-w-0">
                <span className="break-words text-sm font-semibold">
                  {item.name}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Opened at{" "}
                  {item.openingQuantity === null
                    ? "Not recorded"
                    : `${formatQuantity(item.openingQuantity)} ${item.unit}`}
                </span>
              </dt>
              <dd className="break-words text-right text-lg font-bold tabular-nums sm:flex sm:items-center sm:justify-end sm:gap-5">
                <span>
                  {item.quantityOnHand === null
                    ? "Not recorded"
                    : formatQuantity(item.quantityOnHand)}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    {item.quantityOnHand === null ? "" : item.unit}
                  </span>
                  {!historical &&
                  item.quantityOnHand !== null &&
                  Number(item.quantityOnHand) <= 0 ? (
                    <span className="mt-1 block text-xs font-medium text-warning">
                      {Number(item.quantityOnHand) === 0
                        ? "Out of stock"
                        : "Check stock count"}
                    </span>
                  ) : null}
                </span>
                {onAdjust && item.adjustable ? (
                  <div className="mt-2 sm:mt-0">
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      aria-label={`Adjust ${item.name}`}
                      onClick={() => onAdjust(item.inventoryItemId)}
                    >
                      Adjust
                    </Button>
                  </div>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
        {!filtered.length ? (
          <p className="p-5 text-sm text-muted-foreground">
            {balances.length
              ? "No matching items. Try a different search."
              : historical
                ? "No inventory counts were recorded for this shift."
                : onAdjust
                  ? "No stock recorded yet. Use Adjust stock to add an item, or ask an admin to receive supplies."
                  : "No stock has been recorded for this shift yet."}
          </p>
        ) : null}
      </div>
    </section>
  );
}
