"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, ArrowRightLeft, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumericExpressionInput } from "@/components/ui/numeric-expression-input";
import { normalizeNumericExpression } from "@/lib/numeric-expression";
import {
  createCentralInventoryLocationAction,
  receiveStockAction,
  transferStockAction,
} from "@/server/actions/stock";
import { ActionErrorAlert } from "./form-controls";
import type { ActionFeedback } from "./form-utils";

type LocationOption = { id: string; name: string; locationType: string };
type ItemOption = { id: string; name: string; unit: string };

export function StockMovementForm({
  locations,
  items,
}: {
  locations: readonly LocationOption[];
  items: readonly ItemOption[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"receive" | "transfer">("receive");
  const [feedback, setFeedback] = useState<ActionFeedback>({});
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const itemId = String(values.get("inventoryItemId") ?? "");
    const quantity = normalizeNumericExpression(values.get("quantity"), 3);
    setFeedback({});
    startTransition(async () => {
      const common = {
        inventoryItemId: itemId,
        quantity,
      };
      const result =
        mode === "receive"
          ? await receiveStockAction({
              receivingId: crypto.randomUUID(),
              inventoryEventId: crypto.randomUUID(),
              inventoryLocationId: String(
                values.get("inventoryLocationId") ?? "",
              ),
              referenceNumber:
                String(values.get("referenceNumber") ?? "").trim() || null,
              notes: String(values.get("notes") ?? "").trim() || null,
              lines: [common],
            })
          : await transferStockAction({
              transferId: crypto.randomUUID(),
              transferOutEventId: crypto.randomUUID(),
              transferInEventId: crypto.randomUUID(),
              fromInventoryLocationId: String(
                values.get("fromLocationId") ?? "",
              ),
              toInventoryLocationId: String(values.get("toLocationId") ?? ""),
              notes: String(values.get("notes") ?? "").trim() || null,
              lines: [common],
            });
      if (!result.ok) {
        setFeedback({ error: result.error, fieldErrors: result.fieldErrors });
        return;
      }
      form.reset();
      toast.success(
        mode === "receive" ? "Stock received." : "Stock transferred.",
      );
      router.refresh();
    });
  }

  const canSubmit = locations.length > 0 && items.length > 0;

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      <ActionErrorAlert feedback={feedback} />
      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          type="button"
          variant={mode === "receive" ? "default" : "outline"}
          className="h-11 rounded-xl"
          onClick={() => setMode("receive")}
          disabled={isPending}
        >
          <ArrowDownToLine aria-hidden="true" /> Receive stock
        </Button>
        <Button
          type="button"
          variant={mode === "transfer" ? "default" : "outline"}
          className="h-11 rounded-xl"
          onClick={() => setMode("transfer")}
          disabled={isPending}
        >
          <ArrowRightLeft aria-hidden="true" /> Transfer stock
        </Button>
      </div>
      {mode === "receive" ? (
        <div className="space-y-2">
          <Label htmlFor="inventory-location">Receive into</Label>
          <select
            id="inventory-location"
            name="inventoryLocationId"
            required
            className="h-11 w-full rounded-xl border bg-background px-3 text-sm"
            disabled={isPending}
          >
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {(["fromLocationId", "toLocationId"] as const).map((name, index) => (
            <div className="space-y-2" key={name}>
              <Label htmlFor={name}>{index === 0 ? "From" : "To"}</Label>
              <select
                id={name}
                name={name}
                required
                className="h-11 w-full rounded-xl border bg-background px-3 text-sm"
                disabled={isPending}
              >
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-[1fr_0.7fr]">
        <div className="space-y-2">
          <Label htmlFor="inventory-item">Item</Label>
          <select
            id="inventory-item"
            name="inventoryItemId"
            required
            className="h-11 w-full rounded-xl border bg-background px-3 text-sm"
            disabled={isPending}
          >
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.unit}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="quantity">Quantity</Label>
          <NumericExpressionInput
            id="quantity"
            name="quantity"
            precision={3}
            min="0.001"
            step="0.001"
            required
            disabled={isPending}
            className="h-11 rounded-xl"
          />
        </div>
      </div>
      {mode === "receive" ? (
        <div className="space-y-2">
          <Label htmlFor="reference-number">Reference number</Label>
          <Input
            id="reference-number"
            name="referenceNumber"
            maxLength={120}
            disabled={isPending}
            className="h-11 rounded-xl"
            placeholder="Supplier invoice or receipt"
          />
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="stock-notes">Notes</Label>
        <Input
          id="stock-notes"
          name="notes"
          maxLength={2000}
          disabled={isPending}
          className="h-11 rounded-xl"
          placeholder="Optional stock movement note"
        />
      </div>
      <Button
        type="submit"
        className="h-11 rounded-xl"
        disabled={isPending || !canSubmit}
      >
        <Plus aria-hidden="true" />{" "}
        {isPending
          ? "Saving…"
          : mode === "receive"
            ? "Record receiving"
            : "Record transfer"}
      </Button>
      {!canSubmit ? (
        <p className="text-sm text-muted-foreground">
          Add at least one active stock location and inventory item first.
        </p>
      ) : null}
    </form>
  );
}

export function CentralLocationForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<ActionFeedback>({});

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    startTransition(async () => {
      const result = await createCentralInventoryLocationAction({
        name: String(new FormData(form).get("name") ?? ""),
      });
      if (!result.ok) {
        setFeedback({ error: result.error, fieldErrors: result.fieldErrors });
        return;
      }
      form.reset();
      setFeedback({});
      toast.success("Stock location created.");
      router.refresh();
    });
  }

  return (
    <form
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      onSubmit={submit}
      noValidate
    >
      <div className="min-w-0 flex-1 space-y-2">
        <Label htmlFor="central-location-name">New central location</Label>
        <Input
          id="central-location-name"
          name="name"
          required
          minLength={2}
          maxLength={120}
          disabled={isPending}
          className="h-11 rounded-xl"
          placeholder="Main storage"
        />
      </div>
      <Button type="submit" className="h-11 rounded-xl" disabled={isPending}>
        {isPending ? "Creating…" : "Add location"}
      </Button>
      {feedback.error ? (
        <p className="basis-full text-sm text-destructive">{feedback.error}</p>
      ) : null}
    </form>
  );
}
