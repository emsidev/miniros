"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createProductCategoryAction,
  reorderProductCategoriesAction,
  softDeleteProductCategoryAction,
  updateProductCategoryAction,
} from "@/server/actions/product-categories";
import { ActionErrorAlert, SoftDeleteButton } from "./form-controls";
import type { ActionFeedback } from "./form-utils";

type ProductCategoryRecord = {
  id: string;
  name: string;
  productCount: number;
};

export function ProductCategoryManager({
  categories,
}: {
  categories: readonly ProductCategoryRecord[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<ActionFeedback>({});

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = String(new FormData(form).get("name") ?? "");
    setFeedback({});

    startTransition(async () => {
      const result = await createProductCategoryAction({ name });
      if (!result.ok) {
        setFeedback({ error: result.error, fieldErrors: result.fieldErrors });
        return;
      }
      form.reset();
      toast.success(`${result.data.name} was added.`);
      router.refresh();
    });
  }

  function handleRename(
    event: FormEvent<HTMLFormElement>,
    category: ProductCategoryRecord,
  ) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("name") ?? "");
    setFeedback({});

    startTransition(async () => {
      const result = await updateProductCategoryAction({
        categoryId: category.id,
        name,
      });
      if (!result.ok) {
        setFeedback({ error: result.error, fieldErrors: result.fieldErrors });
        return;
      }
      toast.success("Category saved.");
      router.refresh();
    });
  }

  function moveCategory(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= categories.length) return;

    const orderedCategoryIds = categories.map((category) => category.id);
    [orderedCategoryIds[index], orderedCategoryIds[nextIndex]] = [
      orderedCategoryIds[nextIndex],
      orderedCategoryIds[index],
    ];
    setFeedback({});

    startTransition(async () => {
      const result = await reorderProductCategoriesAction({
        categoryIds: orderedCategoryIds,
      });
      if (!result.ok) {
        setFeedback({ error: result.error, fieldErrors: result.fieldErrors });
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <form
        className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-end"
        onSubmit={handleCreate}
        noValidate
      >
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor="new-category-name">New category</Label>
          <Input
            id="new-category-name"
            name="name"
            minLength={2}
            maxLength={80}
            required
            disabled={isPending}
            className="h-11 rounded-xl"
            placeholder="Seasonal specials"
          />
        </div>
        <Button type="submit" className="h-11 rounded-xl" disabled={isPending}>
          <Plus aria-hidden="true" /> Add category
        </Button>
      </form>

      <ActionErrorAlert feedback={feedback} />

      <div className="space-y-3">
        {categories.map((category, index) => (
          <div
            key={category.id}
            className="rounded-xl border bg-card p-4 shadow-none"
          >
            <form
              className="flex flex-col gap-3 sm:flex-row sm:items-center"
              onSubmit={(event) => handleRename(event, category)}
              noValidate
            >
              <div className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={`Move ${category.name} up`}
                  disabled={isPending || index === 0}
                  onClick={() => moveCategory(index, -1)}
                >
                  <ArrowUp aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={`Move ${category.name} down`}
                  disabled={isPending || index === categories.length - 1}
                  onClick={() => moveCategory(index, 1)}
                >
                  <ArrowDown aria-hidden="true" />
                </Button>
              </div>
              <div className="min-w-0 flex-1">
                <Label className="sr-only" htmlFor={`category-${category.id}`}>
                  Category name
                </Label>
                <Input
                  id={`category-${category.id}`}
                  name="name"
                  minLength={2}
                  maxLength={80}
                  required
                  disabled={isPending}
                  defaultValue={category.name}
                  className="h-11 rounded-xl"
                />
              </div>
              <p className="shrink-0 text-sm text-muted-foreground">
                {category.productCount === 1
                  ? "1 product"
                  : `${category.productCount} products`}
              </p>
              <div className="flex shrink-0 gap-2">
                <Button type="submit" variant="outline" disabled={isPending}>
                  <Save aria-hidden="true" /> Save
                </Button>
                <SoftDeleteButton
                  entityName={category.name}
                  triggerLabel="Archive"
                  title={`Archive ${category.name}?`}
                  description="This is available only when the category has no products and at least one other category remains active."
                  confirmLabel="Archive"
                  onDelete={() =>
                    softDeleteProductCategoryAction({ categoryId: category.id })
                  }
                  onDeleted={() => {
                    toast.success(`${category.name} was archived.`);
                    router.refresh();
                  }}
                />
              </div>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
