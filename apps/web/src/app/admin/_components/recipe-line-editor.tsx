"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  EditableRecipeLine,
  InventoryItemOption,
} from "./recipe-form-types";

export function RecipeLineEditor({
  lines,
  inventoryItems,
  error,
  disabled,
  onAdd,
  onChangeItem,
  onChangeQuantity,
  onRemove,
}: {
  lines: EditableRecipeLine[];
  inventoryItems: InventoryItemOption[];
  error?: string;
  disabled: boolean;
  onAdd: () => void;
  onChangeItem: (key: string, inventoryItemId: string) => void;
  onChangeQuantity: (key: string, quantity: string) => void;
  onRemove: (key: string) => void;
}) {
  const usedItemIds = new Set(lines.map((line) => line.inventoryItemId));
  const canAddLine = inventoryItems.some((item) => !usedItemIds.has(item.id));

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-bold">Recipe lines</legend>
      {lines.length === 0 ? (
        <div className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
          No ingredients yet. A product without recipe lines will not deduct
          inventory.
        </div>
      ) : (
        lines.map((line) => (
          <div
            key={line.key}
            className="grid gap-3 rounded-xl border p-3 sm:grid-cols-[1fr_0.42fr_0.32fr_auto] sm:items-end"
          >
            <div className="space-y-2">
              <Label htmlFor={`${line.key}-item`}>Inventory item</Label>
              <Select
                value={line.inventoryItemId}
                onValueChange={(value) => onChangeItem(line.key, value)}
                disabled={disabled}
              >
                <SelectTrigger
                  id={`${line.key}-item`}
                  className="h-11 w-full rounded-xl"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {inventoryItems.map((item) => (
                    <SelectItem
                      key={item.id}
                      value={item.id}
                      disabled={
                        item.id !== line.inventoryItemId &&
                        usedItemIds.has(item.id)
                      }
                    >
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${line.key}-quantity`}>Quantity</Label>
              <Input
                id={`${line.key}-quantity`}
                type="number"
                inputMode="decimal"
                min="0.001"
                step="0.001"
                value={line.quantity}
                onChange={(event) =>
                  onChangeQuantity(line.key, event.target.value)
                }
                disabled={disabled}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${line.key}-unit`}>Unit</Label>
              <Input
                id={`${line.key}-unit`}
                value={line.unit}
                readOnly
                className="h-11 rounded-xl bg-muted"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              onClick={() => onRemove(line.key)}
              disabled={disabled}
              aria-label="Remove recipe line"
              className="justify-self-end text-destructive"
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        ))
      )}
      {error ? (
        <p className="text-xs font-medium text-destructive">{error}</p>
      ) : null}
      <Button
        type="button"
        variant="outline"
        onClick={onAdd}
        disabled={disabled || !canAddLine}
      >
        <Plus aria-hidden="true" />
        Add ingredient
      </Button>
    </fieldset>
  );
}
