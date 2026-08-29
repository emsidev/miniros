"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { inventoryItemTypes, type InventoryItemType } from "@miniros/contracts";
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
import {
  createInventoryItemAction,
  softDeleteInventoryItemAction,
  updateInventoryItemAction,
} from "@/server/actions/inventory-items";
import {
  ActionErrorAlert,
  SetupInput,
  SoftDeleteButton,
  ToggleField,
} from "./form-controls";
import {
  firstFieldError,
  humanize,
  moneyToCents,
  optionalText,
  type ActionFeedback,
} from "./form-utils";

type InventoryItemRecord = {
  id: string;
  name: string;
  sku: string | null;
  itemType: InventoryItemType;
  unit: string;
  defaultUnitCostCents: number;
  trackStock: boolean;
  status: "active" | "inactive" | "deleted";
};

export function CreateInventoryItemDialog({
  item,
}: {
  item?: InventoryItemRecord;
} = {}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [itemType, setItemType] = useState<InventoryItemType>(
    item?.itemType ?? "raw_good",
  );
  const [trackStock, setTrackStock] = useState(item?.trackStock ?? true);
  const [feedback, setFeedback] = useState<ActionFeedback>({});
  const itemTypeError = firstFieldError(feedback, "itemType");
  const isEditing = Boolean(item);

  function resetForm() {
    formRef.current?.reset();
    setItemType(item?.itemType ?? "raw_good");
    setTrackStock(item?.trackStock ?? true);
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
        name: String(formData.get("name") ?? ""),
        sku: optionalText(formData.get("sku")),
        itemType,
        unit: String(formData.get("unit") ?? ""),
        defaultUnitCostCents: moneyToCents(
          formData.get("defaultUnitCostCents"),
        ),
        trackStock,
        status: item?.status === "inactive" ? "inactive" : "active",
      };
      const result = item
        ? await updateInventoryItemAction({
            inventoryItemId: item.id,
            ...values,
          })
        : await createInventoryItemAction(values);

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
          {isEditing ? "Edit" : "Add inventory item"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit inventory item" : "Add inventory item"}
          </DialogTitle>
          <DialogDescription>
            Define the stock unit and its normal unit cost.
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
              label="Item name"
              feedback={feedback}
              name="name"
              minLength={2}
              maxLength={120}
              required
              autoFocus
              disabled={isPending}
              placeholder="Tapioca pearls"
              defaultValue={item?.name}
            />
            <SetupInput
              label="SKU"
              feedback={feedback}
              name="sku"
              maxLength={80}
              disabled={isPending}
              placeholder="RAW-PEARLS"
              defaultValue={item?.sku ?? ""}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="inventory-item-type">Item type</Label>
              <Select
                value={itemType}
                onValueChange={(value) =>
                  setItemType(value as InventoryItemType)
                }
                disabled={isPending}
              >
                <SelectTrigger
                  id="inventory-item-type"
                  className="h-11 w-full rounded-xl"
                  aria-invalid={Boolean(itemTypeError)}
                  aria-describedby={
                    itemTypeError ? "inventory-item-type-error" : undefined
                  }
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {inventoryItemTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {humanize(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {itemTypeError ? (
                <p
                  id="inventory-item-type-error"
                  className="text-xs font-medium text-destructive"
                >
                  {itemTypeError}
                </p>
              ) : null}
            </div>
            <SetupInput
              label="Unit"
              feedback={feedback}
              name="unit"
              minLength={1}
              maxLength={24}
              required
              disabled={isPending}
              placeholder="kg, pcs, ml"
              defaultValue={item?.unit}
            />
          </div>
          <SetupInput
            label="Default unit cost (₱)"
            feedback={feedback}
            name="defaultUnitCostCents"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            defaultValue={((item?.defaultUnitCostCents ?? 0) / 100).toFixed(2)}
            required
            disabled={isPending}
            hint="Used as the default cost snapshot in inventory movements."
          />
          <ToggleField
            id="inventory-track-stock"
            label="Track quantity on hand"
            description="Keep this enabled for any item that should have a live stock balance."
            checked={trackStock}
            onCheckedChange={setTrackStock}
            disabled={isPending}
          />
          <DialogFooter>
            {item ? (
              <SoftDeleteButton
                entityName={item.name}
                onDelete={() =>
                  softDeleteInventoryItemAction({ inventoryItemId: item.id })
                }
                onDeleted={() => {
                  toast.success(`${item.name} was deleted.`);
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
                  ? "Saving item…"
                  : "Adding item…"
                : isEditing
                  ? "Save changes"
                  : "Add item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
