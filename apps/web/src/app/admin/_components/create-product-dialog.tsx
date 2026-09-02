"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
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
import { NumericExpressionInput } from "@/components/ui/numeric-expression-input";
import { Textarea } from "@/components/ui/textarea";
import {
  createProductAction,
  softDeleteProductAction,
  updateProductAction,
} from "@/server/actions/products";
import {
  ActionErrorAlert,
  FieldGroup,
  SetupInput,
  SoftDeleteButton,
  ToggleField,
} from "./form-controls";
import {
  firstFieldError,
  moneyToCents,
  optionalText,
  type ActionFeedback,
} from "./form-utils";

type ProductRecord = {
  id: string;
  categoryId: string;
  name: string;
  sku: string | null;
  description: string | null;
  priceCents: number;
  costCents: number;
  manualCostCents: number;
  laborCostCents: number;
  overheadCostCents: number;
  costOverrideCents: number | null;
  ingredientCostCents: number;
  calculatedCostCents: number;
  costSource: "manual" | "recipe" | "override";
  recipeLineCount: number;
  status: "active" | "inactive" | "deleted";
  isSellable: boolean;
  requiresRecipeDeduction: boolean;
  inventoryMode: "none" | "recipe" | "produced";
  outputInventoryItemId: string | null;
  imageUrl: string | null;
};

type ProductCategoryOption = { id: string; name: string };
type FinishedGoodOption = { id: string; name: string; unit: string };

export function CreateProductDialog({
  product,
  recipesEnabled = true,
  productionEnabled = false,
  categories,
  finishedGoods = [],
}: {
  product?: ProductRecord;
  recipesEnabled?: boolean;
  productionEnabled?: boolean;
  categories: readonly ProductCategoryOption[];
  finishedGoods?: readonly FinishedGoodOption[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isSellable, setIsSellable] = useState(product?.isSellable ?? true);
  const [inventoryMode, setInventoryMode] = useState<
    "none" | "recipe" | "produced"
  >(
    product?.inventoryMode ??
      (product?.requiresRecipeDeduction ? "recipe" : "none"),
  );
  const [outputInventoryItemId, setOutputInventoryItemId] = useState(
    product?.outputInventoryItemId ?? "",
  );
  const [categoryId, setCategoryId] = useState(
    product?.categoryId ?? categories[0]?.id ?? "",
  );
  const [costOverride, setCostOverride] = useState(
    product?.costOverrideCents === null ||
      product?.costOverrideCents === undefined
      ? ""
      : (product.costOverrideCents / 100).toFixed(2),
  );
  const [feedback, setFeedback] = useState<ActionFeedback>({});
  const descriptionError = firstFieldError(feedback, "description");
  const isEditing = Boolean(product);
  const hasAutomaticCost = Boolean(
    product && recipesEnabled && product.recipeLineCount > 0,
  );

  function resetForm() {
    formRef.current?.reset();
    setIsSellable(product?.isSellable ?? true);
    setInventoryMode(
      product?.inventoryMode ??
        (product?.requiresRecipeDeduction ? "recipe" : "none"),
    );
    setOutputInventoryItemId(product?.outputInventoryItemId ?? "");
    setCategoryId(product?.categoryId ?? categories[0]?.id ?? "");
    setCostOverride(
      product?.costOverrideCents === null ||
        product?.costOverrideCents === undefined
        ? ""
        : (product.costOverrideCents / 100).toFixed(2),
    );
    setFeedback({});
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) resetForm();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    setFeedback({});
    startTransition(async () => {
      const values = {
        categoryId,
        name: String(formData.get("name") ?? ""),
        sku: optionalText(formData.get("sku")),
        description: optionalText(formData.get("description")),
        priceCents: moneyToCents(formData.get("priceCents")),
        manualCostCents: hasAutomaticCost
          ? (product?.manualCostCents ?? 0)
          : moneyToCents(formData.get("manualCostCents")),
        costOverrideCents:
          hasAutomaticCost && costOverride.trim()
            ? moneyToCents(costOverride)
            : null,
        status: product?.status === "inactive" ? "inactive" : "active",
        isSellable,
        requiresRecipeDeduction: inventoryMode === "recipe",
        inventoryMode,
        outputInventoryItemId:
          inventoryMode === "produced" ? outputInventoryItemId || null : null,
        imageUrl: product?.imageUrl ?? null,
      };
      const result = product
        ? await updateProductAction({ productId: product.id, ...values })
        : await createProductAction(values);

      if (!result.ok) {
        setFeedback({
          error: result.error,
          fieldErrors: result.fieldErrors,
        });
        return;
      }

      toast.success(
        `${result.data.name} was ${isEditing ? "updated" : "added"}.`,
      );
      setOpen(false);
      resetForm();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant={isEditing ? "outline" : "default"}
          size={isEditing ? "sm" : "default"}
          className={isEditing ? "" : "h-11 rounded-xl"}
        >
          {isEditing ? (
            <Pencil aria-hidden="true" />
          ) : (
            <Plus aria-hidden="true" />
          )}
          {isEditing ? "Edit" : "Add product"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit product" : "Add product"}
          </DialogTitle>
          <DialogDescription>
            Create a sellable item with price and cost snapshots.
          </DialogDescription>
        </DialogHeader>
        <form
          ref={formRef}
          className="space-y-5"
          onSubmit={handleSubmit}
          noValidate
        >
          <ActionErrorAlert feedback={feedback} />
          <div className="grid gap-4 sm:grid-cols-[1fr_0.7fr]">
            <SetupInput
              label="Product name"
              feedback={feedback}
              name="name"
              minLength={2}
              maxLength={120}
              required
              autoFocus
              disabled={isPending}
              placeholder="Classic Milk Tea"
              defaultValue={product?.name}
            />
            <SetupInput
              label="SKU"
              feedback={feedback}
              name="sku"
              maxLength={80}
              disabled={isPending}
              placeholder="Generated automatically"
              hint="Leave blank to generate a unique SKU automatically."
              defaultValue={product?.sku ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="product-category">Category</Label>
            <Select
              value={categoryId}
              onValueChange={setCategoryId}
              disabled={isPending || categories.length === 0}
            >
              <SelectTrigger
                id="product-category"
                className="h-11 w-full rounded-xl"
                aria-invalid={Boolean(feedback.fieldErrors?.categoryId?.[0])}
                aria-describedby={
                  feedback.fieldErrors?.categoryId?.[0]
                    ? "product-category-error"
                    : undefined
                }
              >
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {feedback.fieldErrors?.categoryId?.[0] ? (
              <p
                id="product-category-error"
                className="text-xs font-medium text-destructive"
              >
                {feedback.fieldErrors.categoryId[0]}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="product-description">Description</Label>
            <Textarea
              id="product-description"
              name="description"
              maxLength={1000}
              disabled={isPending}
              aria-invalid={Boolean(descriptionError)}
              aria-describedby={
                descriptionError ? "product-description-error" : undefined
              }
              className="min-h-20 rounded-xl"
              placeholder="Optional details your team should know"
              defaultValue={product?.description ?? ""}
            />
            {descriptionError ? (
              <p
                id="product-description-error"
                className="text-xs font-medium text-destructive"
              >
                {descriptionError}
              </p>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <SetupInput
              label="Selling price (₱)"
              feedback={feedback}
              name="priceCents"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              required
              disabled={isPending}
              placeholder="120.00"
              defaultValue={
                product ? (product.priceCents / 100).toFixed(2) : undefined
              }
            />
            {hasAutomaticCost && product ? (
              <div className="space-y-2">
                <Label htmlFor="product-cost-override">
                  Unit cost override (₱)
                </Label>
                <div className="flex gap-2">
                  <NumericExpressionInput
                    id="product-cost-override"
                    precision={2}
                    min="0"
                    step="0.01"
                    placeholder={(product.calculatedCostCents / 100).toFixed(2)}
                    value={costOverride}
                    onValueChange={setCostOverride}
                    disabled={isPending}
                    className="h-11 rounded-xl"
                    containerClassName="flex-1"
                  />
                  {costOverride ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCostOverride("")}
                      disabled={isPending}
                    >
                      Clear
                    </Button>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  Leave blank to use the calculated recipe cost.
                </p>
              </div>
            ) : (
              <SetupInput
                label="Unit cost (₱)"
                feedback={feedback}
                name="manualCostCents"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                required
                disabled={isPending}
                placeholder="45.00"
                hint="Used until this product has a recipe with automatic costing."
                defaultValue={
                  product
                    ? (product.manualCostCents / 100).toFixed(2)
                    : undefined
                }
              />
            )}
          </div>
          {hasAutomaticCost && product ? (
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/60 p-3 text-sm sm:grid-cols-4">
              <div>
                <p className="text-muted-foreground">Ingredients</p>
                <p className="font-bold">
                  ₱{(product.ingredientCostCents / 100).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Labor</p>
                <p className="font-bold">
                  ₱{(product.laborCostCents / 100).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Overhead</p>
                <p className="font-bold">
                  ₱{(product.overheadCostCents / 100).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Calculated</p>
                <p className="font-bold">
                  ₱{(product.calculatedCostCents / 100).toFixed(2)}
                </p>
              </div>
            </div>
          ) : null}
          <FieldGroup label="Selling behavior">
            <ToggleField
              id="product-sellable"
              label="Available in POS"
              description="Operators can add this product to a sale."
              checked={isSellable}
              onCheckedChange={setIsSellable}
              disabled={isPending}
            />
          </FieldGroup>
          <div className="space-y-2">
            <Label htmlFor="product-inventory-mode">Inventory behavior</Label>
            <Select
              value={inventoryMode}
              onValueChange={(value) =>
                setInventoryMode(value as "none" | "recipe" | "produced")
              }
              disabled={isPending}
            >
              <SelectTrigger
                id="product-inventory-mode"
                className="h-11 w-full rounded-xl"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No automatic deduction</SelectItem>
                <SelectItem value="recipe" disabled={!recipesEnabled}>
                  Recipe deduction at sale
                </SelectItem>
                <SelectItem value="produced" disabled={!productionEnabled}>
                  Produced stock
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {inventoryMode === "produced"
                ? "POS deducts finished goods. Production consumes recipe inputs separately."
                : inventoryMode === "recipe"
                  ? "Each completed sale deducts the product recipe from booth stock."
                  : "Sales do not change inventory automatically."}
            </p>
          </div>
          {inventoryMode === "produced" ? (
            <div className="space-y-2">
              <Label htmlFor="product-output-item">Finished-good output</Label>
              <Select
                value={outputInventoryItemId}
                onValueChange={setOutputInventoryItemId}
                disabled={isPending || finishedGoods.length === 0}
              >
                <SelectTrigger
                  id="product-output-item"
                  className="h-11 w-full rounded-xl"
                >
                  <SelectValue placeholder="Select a finished-good item" />
                </SelectTrigger>
                <SelectContent>
                  {finishedGoods.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} ({item.unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {finishedGoods.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Add an active, tracked finished-good inventory item first.
                </p>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            {product ? (
              <SoftDeleteButton
                entityName={product.name}
                onDelete={() =>
                  softDeleteProductAction({ productId: product.id })
                }
                onDeleted={() => {
                  toast.success(`${product.name} was deleted.`);
                  setOpen(false);
                  router.refresh();
                }}
              />
            ) : null}
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={
                isPending ||
                categoryId.length === 0 ||
                (inventoryMode === "produced" &&
                  outputInventoryItemId.length === 0)
              }
            >
              {isPending
                ? isEditing
                  ? "Saving product…"
                  : "Adding product…"
                : isEditing
                  ? "Save changes"
                  : "Add product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
