"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { replaceRecipeAction } from "@/server/actions/recipes";
import { ActionErrorAlert } from "./form-controls";
import { firstFieldError, type ActionFeedback } from "./form-utils";
import { RecipeLineEditor } from "./recipe-line-editor";
import type {
  EditableRecipeLine,
  InventoryItemOption,
  ProductOption,
  SavedRecipeLine,
} from "./recipe-form-types";

function editableLines(lines: SavedRecipeLine[]): EditableRecipeLine[] {
  return lines.map((line) => ({ ...line, key: line.id }));
}

export function ManageRecipeDialog({
  products,
  inventoryItems,
  recipes,
}: {
  products: ProductOption[];
  inventoryItems: InventoryItemOption[];
  recipes: Record<string, SavedRecipeLine[]>;
}) {
  const router = useRouter();
  const nextLineId = useRef(0);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [selectedProductId, setSelectedProductId] = useState(
    products[0]?.id ?? "",
  );
  const [lines, setLines] = useState<EditableRecipeLine[]>(
    editableLines(recipes[products[0]?.id ?? ""] ?? []),
  );
  const [feedback, setFeedback] = useState<ActionFeedback>({});
  const linesError = firstFieldError(feedback, "lines");

  function selectProduct(productId: string) {
    setSelectedProductId(productId);
    setLines(editableLines(recipes[productId] ?? []));
    setFeedback({});
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      const productId = products[0]?.id ?? "";
      setSelectedProductId(productId);
      setLines(editableLines(recipes[productId] ?? []));
      setFeedback({});
    }
  }

  function addLine() {
    const usedItemIds = new Set(lines.map((line) => line.inventoryItemId));
    const item = inventoryItems.find((option) => !usedItemIds.has(option.id));
    if (!item) return;

    nextLineId.current += 1;
    setLines((current) => [
      ...current,
      {
        id: "",
        key: `new-${nextLineId.current}`,
        inventoryItemId: item.id,
        quantity: "1",
        unit: item.unit,
      },
    ]);
  }

  function updateLine(
    key: string,
    patch: Partial<
      Pick<EditableRecipeLine, "inventoryItemId" | "quantity" | "unit">
    >,
  ) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  function changeInventoryItem(key: string, inventoryItemId: string) {
    const item = inventoryItems.find((option) => option.id === inventoryItemId);
    if (!item) return;
    updateLine(key, { inventoryItemId, unit: item.unit });
  }

  function removeLine(key: string) {
    setLines((current) => current.filter((line) => line.key !== key));
  }

  function handleSave() {
    setFeedback({});
    startTransition(async () => {
      const result = await replaceRecipeAction({
        productId: selectedProductId,
        lines: lines.map(({ inventoryItemId, quantity, unit }) => ({
          inventoryItemId,
          quantity,
          unit,
        })),
      });

      if (!result.ok) {
        setFeedback({
          error: result.error,
          fieldErrors: result.fieldErrors,
        });
        return;
      }

      toast.success(
        result.data.lines.length > 0
          ? `${result.data.product.name} recipe saved.`
          : `${result.data.product.name} recipe cleared.`,
      );
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="h-11 rounded-xl">
          <Plus aria-hidden="true" />
          Manage recipe
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage product recipe</DialogTitle>
          <DialogDescription>
            Inventory is deducted using these quantities for every unit sold.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <ActionErrorAlert feedback={feedback} />
          <div className="space-y-2">
            <Label htmlFor="recipe-product">Product</Label>
            <Select
              value={selectedProductId}
              onValueChange={selectProduct}
              disabled={isPending}
            >
              <SelectTrigger
                id="recipe-product"
                className="h-11 w-full rounded-xl"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <RecipeLineEditor
            lines={lines}
            inventoryItems={inventoryItems}
            error={linesError}
            disabled={isPending}
            onAdd={addLine}
            onChangeItem={changeInventoryItem}
            onChangeQuantity={(key, quantity) => updateLine(key, { quantity })}
            onRemove={removeLine}
          />

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isPending || !selectedProductId}
            >
              {isPending ? "Saving recipe…" : "Save recipe"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
