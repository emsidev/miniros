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
  categoryId: string | null;
  name: string;
  sku: string | null;
  description: string | null;
  priceCents: number;
  costCents: number;
  status: "active" | "inactive" | "deleted";
  isSellable: boolean;
  requiresRecipeDeduction: boolean;
  imageUrl: string | null;
};

export function CreateProductDialog({
  product,
}: {
  product?: ProductRecord;
} = {}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isSellable, setIsSellable] = useState(product?.isSellable ?? true);
  const [requiresRecipeDeduction, setRequiresRecipeDeduction] = useState(
    product?.requiresRecipeDeduction ?? false,
  );
  const [feedback, setFeedback] = useState<ActionFeedback>({});
  const descriptionError = firstFieldError(feedback, "description");
  const isEditing = Boolean(product);

  function resetForm() {
    formRef.current?.reset();
    setIsSellable(product?.isSellable ?? true);
    setRequiresRecipeDeduction(product?.requiresRecipeDeduction ?? false);
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
        categoryId: product?.categoryId ?? null,
        name: String(formData.get("name") ?? ""),
        sku: optionalText(formData.get("sku")),
        description: optionalText(formData.get("description")),
        priceCents: moneyToCents(formData.get("priceCents")),
        costCents: moneyToCents(formData.get("costCents")),
        status: product?.status === "inactive" ? "inactive" : "active",
        isSellable,
        requiresRecipeDeduction,
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
              placeholder="MT-CLASSIC"
              defaultValue={product?.sku ?? ""}
            />
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
            <SetupInput
              label="Unit cost (₱)"
              feedback={feedback}
              name="costCents"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              required
              disabled={isPending}
              placeholder="45.00"
              defaultValue={
                product ? (product.costCents / 100).toFixed(2) : undefined
              }
            />
          </div>
          <FieldGroup label="Selling behavior">
            <ToggleField
              id="product-sellable"
              label="Available in POS"
              description="Operators can add this product to a sale."
              checked={isSellable}
              onCheckedChange={setIsSellable}
              disabled={isPending}
            />
            <ToggleField
              id="product-recipe-deduction"
              label="Deduct inventory using a recipe"
              description="A completed sale will consume the recipe quantities automatically."
              checked={requiresRecipeDeduction}
              onCheckedChange={setRequiresRecipeDeduction}
              disabled={isPending}
            />
          </FieldGroup>
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
            <Button type="submit" disabled={isPending}>
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
