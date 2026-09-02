"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { calculateStandardRecipeCost } from "@miniros/domain";
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
import { formatMoney } from "@/lib/format";
import { normalizeNumericExpression } from "@/lib/numeric-expression";
import { NumericExpressionInput } from "@/components/ui/numeric-expression-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { replaceRecipeAction } from "@/server/actions/recipes";
import { ActionErrorAlert } from "./form-controls";
import {
  firstFieldError,
  moneyToCents,
  type ActionFeedback,
} from "./form-utils";
import { RecipeLineEditor } from "./recipe-line-editor";
import type {
  EditableRecipeLine,
  InventoryItemOption,
  ProductOption,
  RecipeEditorValue,
} from "./recipe-form-types";

function editableLines(
  lines: RecipeEditorValue["lines"],
): EditableRecipeLine[] {
  return lines.map((line) => ({ ...line, key: line.id }));
}

const emptyRecipe: RecipeEditorValue = {
  lines: [],
  laborCostCents: 0,
  overheadCostCents: 0,
};

function centsInput(value: number) {
  return (value / 100).toFixed(2);
}

export function ManageRecipeDialog({
  products,
  inventoryItems,
  recipes,
}: {
  products: ProductOption[];
  inventoryItems: InventoryItemOption[];
  recipes: Record<string, RecipeEditorValue>;
}) {
  const router = useRouter();
  const nextLineId = useRef(0);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [selectedProductId, setSelectedProductId] = useState(
    products[0]?.id ?? "",
  );
  const [lines, setLines] = useState<EditableRecipeLine[]>(
    editableLines(recipes[products[0]?.id ?? ""]?.lines ?? []),
  );
  const initialRecipe = recipes[products[0]?.id ?? ""] ?? emptyRecipe;
  const [laborCost, setLaborCost] = useState(
    centsInput(initialRecipe.laborCostCents),
  );
  const [overheadCost, setOverheadCost] = useState(
    centsInput(initialRecipe.overheadCostCents),
  );
  const [feedback, setFeedback] = useState<ActionFeedback>({});
  const linesError = firstFieldError(feedback, "lines");

  function selectProduct(productId: string) {
    const recipe = recipes[productId] ?? emptyRecipe;
    setSelectedProductId(productId);
    setLines(editableLines(recipe.lines));
    setLaborCost(centsInput(recipe.laborCostCents));
    setOverheadCost(centsInput(recipe.overheadCostCents));
    setFeedback({});
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      const productId = products[0]?.id ?? "";
      const recipe = recipes[productId] ?? emptyRecipe;
      setSelectedProductId(productId);
      setLines(editableLines(recipe.lines));
      setLaborCost(centsInput(recipe.laborCostCents));
      setOverheadCost(centsInput(recipe.overheadCostCents));
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
        unitCostCents: item.defaultUnitCostCents,
      },
    ]);
  }

  function updateLine(
    key: string,
    patch: Partial<
      Pick<
        EditableRecipeLine,
        "inventoryItemId" | "quantity" | "unit" | "unitCostCents"
      >
    >,
  ) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  function changeInventoryItem(key: string, inventoryItemId: string) {
    const item = inventoryItems.find((option) => option.id === inventoryItemId);
    if (!item) return;
    updateLine(key, {
      inventoryItemId,
      unit: item.unit,
      unitCostCents: item.defaultUnitCostCents,
    });
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
          quantity: normalizeNumericExpression(quantity, 3),
          unit,
        })),
        laborCostCents: moneyToCents(laborCost),
        overheadCostCents: moneyToCents(overheadCost),
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

  let preview = {
    ingredientCostCents: 0,
    laborCostCents: 0,
    overheadCostCents: 0,
    totalCostCents: 0,
  };
  try {
    preview = calculateStandardRecipeCost({
      lines: lines.map((line) => ({
        quantity: line.quantity,
        unitCostCents: line.unitCostCents,
      })),
      laborCostCents: moneyToCents(laborCost),
      overheadCostCents: moneyToCents(overheadCost),
    });
  } catch {
    // Invalid in-progress input is validated when the recipe is saved.
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
            Set the ingredients and standard costs used for each product unit.
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

          <fieldset className="space-y-3">
            <legend className="text-sm font-bold">
              Standard per-unit costs
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="recipe-labor-cost">Labor (₱)</Label>
                <NumericExpressionInput
                  id="recipe-labor-cost"
                  precision={2}
                  min="0"
                  step="0.01"
                  value={laborCost}
                  onValueChange={setLaborCost}
                  disabled={isPending}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recipe-overhead-cost">Overhead (₱)</Label>
                <NumericExpressionInput
                  id="recipe-overhead-cost"
                  precision={2}
                  min="0"
                  step="0.01"
                  value={overheadCost}
                  onValueChange={setOverheadCost}
                  disabled={isPending}
                  className="h-11 rounded-xl"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/60 p-3 text-sm sm:grid-cols-4">
              <div>
                <p className="text-muted-foreground">Ingredients</p>
                <p className="font-bold">
                  {formatMoney(preview.ingredientCostCents)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Labor</p>
                <p className="font-bold">
                  {formatMoney(preview.laborCostCents)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Overhead</p>
                <p className="font-bold">
                  {formatMoney(preview.overheadCostCents)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Calculated total</p>
                <p className="font-bold">
                  {formatMoney(preview.totalCostCents)}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Saving any costing input clears a temporary product cost override.
            </p>
          </fieldset>

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
