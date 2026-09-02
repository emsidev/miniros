"use client";

import { useMemo, useState } from "react";
import type { InventoryItemType } from "@miniros/contracts";
import { Box, ScanBarcode } from "lucide-react";
import { EmptyState, StatusBadge } from "@/components/shared/feedback";
import { SearchInput } from "@/components/shared/inputs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import { CreateInventoryItemDialog } from "./create-inventory-item-dialog";
import {
  getInventoryItemPreset,
  inventoryItemPresets,
  type InventoryItemRecord,
} from "./inventory-item-presets";

export function InventoryItemCatalog({
  items,
}: {
  items: InventoryItemRecord[];
}) {
  const [query, setQuery] = useState("");
  const [selectedItemType, setSelectedItemType] = useState<
    InventoryItemType | "all"
  >("all");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        const matchesCategory =
          selectedItemType === "all" || item.itemType === selectedItemType;
        const matchesSearch =
          normalizedQuery.length === 0 ||
          item.name.toLocaleLowerCase().includes(normalizedQuery) ||
          item.sku?.toLocaleLowerCase().includes(normalizedQuery);

        return matchesCategory && matchesSearch;
      }),
    [items, normalizedQuery, selectedItemType],
  );

  function clearFilters() {
    setQuery("");
    setSelectedItemType("all");
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-xl border bg-card p-4 shadow-none">
        <SearchInput
          aria-label="Search inventory items"
          placeholder="Search by item name or SKU"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div
          className="flex flex-wrap gap-2"
          aria-label="Filter inventory items by category"
        >
          <Button
            type="button"
            size="sm"
            variant={selectedItemType === "all" ? "default" : "outline"}
            className="h-9 rounded-xl"
            aria-pressed={selectedItemType === "all"}
            onClick={() => setSelectedItemType("all")}
          >
            All items
          </Button>
          {inventoryItemPresets.map((preset) => (
            <Button
              key={preset.itemType}
              type="button"
              size="sm"
              variant={
                selectedItemType === preset.itemType ? "default" : "outline"
              }
              className="h-9 rounded-xl"
              aria-pressed={selectedItemType === preset.itemType}
              onClick={() => setSelectedItemType(preset.itemType)}
            >
              {preset.pluralLabel}
            </Button>
          ))}
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <EmptyState
          title="No matching inventory items"
          description="Try a different search or category, or clear the current filters."
          action={
            <Button type="button" variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filteredItems.map((item) => {
            const preset = getInventoryItemPreset(item.itemType);

            return (
              <Card key={item.id} className="rounded-xl py-5 shadow-none">
                <div className="flex items-start gap-3 px-5">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted">
                    <Box className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="truncate font-bold">
                      {item.name}
                    </CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {preset.label}
                    </p>
                  </div>
                  <CreateInventoryItemDialog item={item} />
                </div>
                <CardContent className="space-y-3 px-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      {formatMoney(item.defaultUnitCostCents)} per {item.unit}
                    </Badge>
                    <Badge variant="outline">
                      {item.trackStock
                        ? "Included in stock counts"
                        : "Not counted in stock"}
                    </Badge>
                  </div>
                  {item.sku || item.status !== "active" ? (
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {item.sku ? (
                        <span className="flex items-center gap-1.5">
                          <ScanBarcode
                            className="size-3.5"
                            aria-hidden="true"
                          />
                          {item.sku}
                        </span>
                      ) : null}
                      {item.status !== "active" ? (
                        <StatusBadge status={item.status} />
                      ) : null}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
