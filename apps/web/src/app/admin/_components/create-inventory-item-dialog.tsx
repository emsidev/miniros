"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  inventoryUnits,
  type InventoryItemType,
  type InventoryUnit,
} from "@miniros/contracts";
import {
  Box,
  CookingPot,
  Package,
  Pencil,
  Plus,
  Wrench,
  type LucideIcon,
} from "lucide-react";
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
  getInventoryItemPreset,
  inventoryItemPresets,
  type InventoryItemRecord,
} from "./inventory-item-presets";
import { moneyToCents, optionalText, type ActionFeedback } from "./form-utils";

const presetIcons: Record<InventoryItemType, LucideIcon> = {
  raw_good: CookingPot,
  packaging: Package,
  consumable: Box,
  non_consumable: Wrench,
  finished_good: Package,
};

type FormValues = {
  name: string;
  sku: string;
  unit: InventoryUnit;
  defaultUnitCost: string;
};

function initialFormValues(item?: InventoryItemRecord): FormValues {
  return {
    name: item?.name ?? "",
    sku: item?.sku ?? "",
    unit: item?.unit ?? getInventoryItemPreset("raw_good").defaultUnit,
    defaultUnitCost: ((item?.defaultUnitCostCents ?? 0) / 100).toFixed(2),
  };
}

function initialOptionalOpen(item?: InventoryItemRecord) {
  if (!item) return false;

  return (
    item.trackStock !== getInventoryItemPreset(item.itemType).defaultTrackStock
  );
}

export function CreateInventoryItemDialog({
  item,
}: {
  item?: InventoryItemRecord;
} = {}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<"kind" | "details">(
    item ? "details" : "kind",
  );
  const [itemType, setItemType] = useState(item?.itemType ?? "raw_good");
  const [formValues, setFormValues] = useState(() => initialFormValues(item));
  const [trackStock, setTrackStock] = useState(item?.trackStock ?? true);
  const [optionalOpen, setOptionalOpen] = useState(() =>
    initialOptionalOpen(item),
  );
  const [feedback, setFeedback] = useState<ActionFeedback>({});
  const isEditing = Boolean(item);
  const currentPreset = getInventoryItemPreset(itemType);
  const Icon = presetIcons[itemType];

  function resetForm() {
    setStep(item ? "details" : "kind");
    setItemType(item?.itemType ?? "raw_good");
    setFormValues(initialFormValues(item));
    setTrackStock(item?.trackStock ?? true);
    setOptionalOpen(initialOptionalOpen(item));
    setFeedback({});
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) resetForm();
  }

  function choosePreset(nextItemType: typeof itemType) {
    const preset = getInventoryItemPreset(nextItemType);
    setItemType(nextItemType);

    if (!item) {
      setFormValues((current) => ({ ...current, unit: preset.defaultUnit }));
      setTrackStock(preset.defaultTrackStock);
    }

    setFeedback({});
    setStep("details");
  }

  function changeUnit(value: InventoryUnit) {
    setFormValues((current) => ({ ...current, unit: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback({});

    startTransition(async () => {
      const values = {
        name: formValues.name,
        sku: optionalText(formValues.sku),
        itemType,
        unit: formValues.unit,
        defaultUnitCostCents: moneyToCents(formValues.defaultUnitCost),
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
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? "Edit inventory item"
              : step === "kind"
                ? "What kind of item is this?"
                : "Add inventory item"}
          </DialogTitle>
          <DialogDescription>
            {step === "kind"
              ? "Choose the closest option. You can change it later."
              : "Add the measurement and cost your team uses when handling this item."}
          </DialogDescription>
        </DialogHeader>

        {step === "kind" ? (
          <div className="space-y-4">
            <p className="text-xs font-semibold text-muted-foreground">
              Step 1 of 2
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {inventoryItemPresets.map((preset) => {
                const PresetIcon = presetIcons[preset.itemType];
                const isSelected = itemType === preset.itemType;

                return (
                  <Button
                    key={preset.itemType}
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                    className="h-auto min-h-28 w-full items-start justify-start rounded-xl p-4 text-left whitespace-normal"
                    aria-pressed={isSelected}
                    disabled={isPending}
                    onClick={() => choosePreset(preset.itemType)}
                  >
                    <PresetIcon
                      className="mt-0.5 size-5 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="space-y-1">
                      <span className="block font-semibold">
                        {preset.label}
                      </span>
                      <span className="block text-xs font-normal leading-relaxed opacity-80">
                        {preset.description}
                      </span>
                    </span>
                  </Button>
                );
              })}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isPending}>
                  Cancel
                </Button>
              </DialogClose>
            </DialogFooter>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            <ActionErrorAlert feedback={feedback} />
            {!isEditing ? (
              <p className="text-xs font-semibold text-muted-foreground">
                Step 2 of 2
              </p>
            ) : null}
            <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-background">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{currentPreset.label}</p>
                <p className="text-xs text-muted-foreground">
                  {currentPreset.description}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => setStep("kind")}
              >
                Change
              </Button>
            </div>

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
              value={formValues.name}
              onChange={(event) =>
                setFormValues((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />

            <div className="space-y-2">
              <Label htmlFor="inventory-item-unit">Measurement unit</Label>
              <Select
                value={formValues.unit}
                onValueChange={(value) => changeUnit(value as InventoryUnit)}
                disabled={isPending}
              >
                <SelectTrigger
                  id="inventory-item-unit"
                  className="h-11 w-full rounded-xl"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {inventoryUnits.map((unit) => (
                    <SelectItem key={unit.value} value={unit.value}>
                      {unit.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <SetupInput
              label="SKU"
              feedback={feedback}
              name="sku"
              maxLength={80}
              disabled={isPending}
              placeholder="Generated automatically"
              hint="Leave blank to generate a unique SKU automatically."
              value={formValues.sku}
              onChange={(event) =>
                setFormValues((current) => ({
                  ...current,
                  sku: event.target.value,
                }))
              }
            />

            <SetupInput
              label={`Cost per ${formValues.unit || "unit"} (₱)`}
              feedback={feedback}
              name="defaultUnitCostCents"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              required
              disabled={isPending}
              hint="Used as the default cost when stock is received, counted, or deducted."
              value={formValues.defaultUnitCost}
              onValueChange={(defaultUnitCost) =>
                setFormValues((current) => ({ ...current, defaultUnitCost }))
              }
            />

            <details
              className="rounded-xl border bg-muted/20 p-4"
              open={optionalOpen}
              onToggle={(event) => setOptionalOpen(event.currentTarget.open)}
            >
              <summary className="cursor-pointer font-semibold">
                Optional settings
              </summary>
              <div className="mt-4 space-y-4">
                <ToggleField
                  id="inventory-track-stock"
                  label="Track quantity on hand"
                  description="Turn this on when your team should receive, count, transfer, or adjust this item as stock."
                  checked={trackStock}
                  onCheckedChange={setTrackStock}
                  disabled={isPending}
                />
              </div>
            </details>

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
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => setStep("kind")}
                >
                  Back
                </Button>
              )}
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
        )}
      </DialogContent>
    </Dialog>
  );
}
