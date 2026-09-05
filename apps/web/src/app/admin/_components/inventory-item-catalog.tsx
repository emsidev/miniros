"use client";

import { AdminTable } from "@/components/shared/admin-table";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMemo, useState } from "react";
import type { InventoryItemType } from "@miniros/contracts";
import { EmptyState, StatusBadge } from "@/components/shared/feedback";
import { SearchInput } from "@/components/shared/inputs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
        <AdminTable label="Inventory items">
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Item</TableHead>
              <TableHead scope="col">SKU</TableHead>
              <TableHead scope="col">Type</TableHead>
              <TableHead scope="col">Unit</TableHead>
              <TableHead scope="col" className="text-right">
                Unit cost
              </TableHead>
              <TableHead scope="col">Stock counts</TableHead>
              <TableHead scope="col">Status</TableHead>
              <TableHead scope="col" className="text-right">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="min-w-48 max-w-72 whitespace-normal break-words font-semibold">
                  {item.name}
                </TableCell>
                <TableCell className="max-w-48 whitespace-normal break-words text-muted-foreground">
                  {item.sku || "—"}
                </TableCell>
                <TableCell>
                  {getInventoryItemPreset(item.itemType).label}
                </TableCell>
                <TableCell>{item.unit}</TableCell>
                <TableCell className="text-right font-semibold">
                  {formatMoney(item.defaultUnitCostCents)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {item.trackStock ? "Included" : "Not counted"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <StatusBadge status={item.status} />
                </TableCell>
                <TableCell className="text-right">
                  <CreateInventoryItemDialog item={item} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </AdminTable>
      )}
    </div>
  );
}
